package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/docker/go-connections/nat"
	"github.com/gin-gonic/gin"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	InvalidTaskInput           = "Invalid Input"
	TaskCreationSuccessMessage = "Task Created Successfully"
	NotFoundMessage            = "Task Not Found"
	InvalidId                  = "Invalid Task Id"
	InvalidStatus              = "Invalid Status Value"
	DropTableQuery             = "DROP TABLE task;"
	tableCreation              = `CREATE TABLE IF NOT EXISTS task
(
    id SERIAL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pinned',
    CONSTRAINT task_pkey PRIMARY KEY (id)
)`
)

var (
	statusValue = map[string]bool{"done": true, "pinned": true}
)

func (db *Database) DeleteAllRows() {
	db.dbInstance.Exec("DELETE FROM task")
	db.dbInstance.Exec("ALTER SEQUENCE task_id_seq RESTART WITH 1")
}

func (db *Database) CreateTableIfNotExists() error {
	_, err := db.dbInstance.Exec(tableCreation)
	return err
}

func (db *Database) DropTable() {
	db.dbInstance.Exec(DropTableQuery)
}

func assertNoError(t *testing.T, err error) {
	if err != nil {
		t.Errorf("expected no error but got %s", err)
	}
}

func assertResponseCode(t *testing.T, got, wanted int) {
	if got != wanted {
		t.Errorf("expected %v but got %v", wanted, got)
	}
}

func assertResponseBody(t *testing.T, wanted, got string) {
	if got != wanted {
		t.Errorf("Expected %s body but Got %s", wanted, got)
	}
}

func sendRequest(request *http.Request, a App) *httptest.ResponseRecorder {
	actualResponse := httptest.NewRecorder()
	a.Router.ServeHTTP(actualResponse, request)

	return actualResponse
}

func CreateTestContainer(ctx context.Context, dbname string) (testcontainers.Container, *sql.DB, error) {
	var env = map[string]string{
		"POSTGRES_PASSWORD": "password",
		"POSTGRES_USER":     "postgres",
		"POSTGRES_DB":       dbname,
	}
	var port = "5432/tcp"
	dbURL := func(port nat.Port) string {
		return fmt.Sprintf("postgres://postgres:password@localhost:%s/%s?sslmode=disable", port.Port(), dbname)
	}

	req := testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "postgres:latest",
			ExposedPorts: []string{port},
			Cmd:          []string{"postgres", "-c", "fsync=off"},
			Env:          env,
			WaitingFor:   wait.ForSQL(nat.Port(port), "postgres", dbURL).Timeout(time.Second * 5),
		},
		Started: true,
	}
	
	container, err := testcontainers.GenericContainer(ctx, req)
	if err != nil {
		return container, nil, fmt.Errorf("failed to start container: %s", err)
	}

	mappedPort, err := container.MappedPort(ctx, nat.Port(port))
	if err != nil {
		return container, nil, fmt.Errorf("failed to get container external port: %s", err)
	}

	log.Println("postgres container ready and running at port: ", mappedPort)

	url := fmt.Sprintf("postgres://postgres:password@localhost:%s/%s?sslmode=disable", mappedPort.Port(), dbname)
	db, err := sql.Open("postgres", url)
	if err != nil {
		return container, db, fmt.Errorf("failed to establish database connection: %s", err)
	}

	return container, db, nil
}

func SetupDatabaseContainer(t *testing.T) (App, testcontainers.Container, context.Context) {
	var a App
	ctx := context.Background()
	a.DB = &Database{}
	container, db, err := CreateTestContainer(ctx, "testdb")
	if err != nil {
		t.Fatal(err)
	}
	a.DB.dbInstance = db
	err = a.DB.CreateTableIfNotExists()
	if err != nil{
		t.Error(err)
	}
	a.Router = gin.Default()
	a.Router.Use(LoggerMiddleware())
	a.SetupRoutes()
	return a, container, ctx
}
