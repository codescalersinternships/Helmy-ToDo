package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

)
func TestGetAllTasks(t *testing.T)  {
	
	a, container, ctx := SetupDatabaseContainer(t)
	defer container.Terminate(ctx)
	defer a.DB.dbInstance.Close()
	t.Run("test an empty todo list", func(t *testing.T) {
		request, err := http.NewRequest("GET", "/home", nil)
	assertNoError(t,err)
	actualResponse := sendRequest(request, a)
	assertResponseCode(t, actualResponse.Code, 200)

	assertResponseBody(t, "[]", actualResponse.Body.String())
	})
	t.Run("test with tasks", func(t *testing.T) {
		t1 := Task{ID: 1, Title: "Testing", Status: "done"}

		tasks := []string{}

		err := a.DB.AddTask(t1)
		assertNoError(t, err)

		j1, err := json.Marshal(t1)
		assertNoError(t, err)

		t2 := Task{ID: 2, Title: "T2", Status: "pending"}
		err = a.DB.AddTask(t2)
		assertNoError(t, err)

		j2, err := json.Marshal(t2)
		assertNoError(t, err)
		tasks = append(tasks, string(j1)+","+string(j2))

		request, err := http.NewRequest("GET", "/home", nil)

		assertNoError(t, err)

		actualResponse := sendRequest(request, a)

		assertResponseCode(t, actualResponse.Code, 200)
		got := actualResponse.Body.String()
		want := strings.Join(tasks, " ")

		if got[1:len(got)-1] != want {
			t.Errorf("expected %v got %v", want, got)
		}

	})
}


func TestGetTask(t *testing.T) {
	a, container, ctx := SetupDatabaseContainer(t)
	defer container.Terminate(ctx)
	defer a.DB.dbInstance.Close()

	t.Run("test non existing task id", func(t *testing.T) {
		request, _ := http.NewRequest("GET", "/todo/5", nil)

		actualResponse := sendRequest(request, a)

		assertResponseCode(t, actualResponse.Code, http.StatusNotFound)

		got := actualResponse.Body.String()

		assertResponseBody(t, NotFoundMessage, got[1:len(got)-1])

	})

	t.Run("test get an existing task id", func(t *testing.T) {

		request, err := http.NewRequest("GET", "/todo/1", nil)

		assertNoError(t, err)
		task := Task{Title: "Testing"}

		err = a.DB.AddTask(task)
		assertNoError(t, err)

		actualResponse := sendRequest(request, a)

		assertResponseCode(t, actualResponse.Code, 200)
	})

	t.Run("test invalid task id value", func(t *testing.T) {
		request, err := http.NewRequest("GET", "/todo/h", nil)

		assertNoError(t, err)

		actualResponse := sendRequest(request, a)

		assertResponseCode(t, actualResponse.Code, http.StatusBadRequest)
		got := actualResponse.Body.String()
		assertResponseBody(t, InvalidId, got[1:len(got)-1])
	})
}

func TestGetAllTasksByStatus(t *testing.T) {

	a, container, ctx := SetupDatabaseContainer(t)
	defer container.Terminate(ctx)
	defer a.DB.dbInstance.Close()

	t.Run("test invalid status value", func(t *testing.T) {
		request, err := http.NewRequest("GET", "/todo/status/sk", nil)

		assertNoError(t, err)
		actualResponse := sendRequest(request, a)

		assertResponseCode(t, actualResponse.Code, http.StatusBadRequest)
		got := actualResponse.Body.String()

		assertResponseBody(t, InvalidStatus, got[1:len(got)-1])
	})

	t.Run("test valid status value", func(t *testing.T) {
		t1 := Task{ID: 1, Title: "Testing", Status: "done"}

		tasks := []string{}

		err := a.DB.AddTask(t1)

		assertNoError(t, err)
		j1, err := json.Marshal(t1)
		assertNoError(t, err)
		tasks = append(tasks, string(j1))

		request, err := http.NewRequest("GET", "/todo/status/done", nil)

		assertNoError(t, err)

		actualResponse := sendRequest(request, a)

		assertResponseCode(t, actualResponse.Code, 200)
		got := actualResponse.Body.String()
		want := strings.Join(tasks, " ")

		if got[1:len(got)-1] != want {
			t.Errorf("expected %v got %v", want, got)
		}

	})
}

func TestDeleteTask(t *testing.T) {
	a, container, ctx := SetupDatabaseContainer(t)
	defer container.Terminate(ctx)
	defer a.DB.dbInstance.Close()

	t.Run("test invalid Id", func(t *testing.T) {

		request, err := http.NewRequest("DELETE", "/todo/h", nil)
		assertNoError(t, err)

		actualResponse := sendRequest(request, a)

		assertResponseCode(t, actualResponse.Code, 400)
		got := actualResponse.Body.String()
		assertResponseBody(t, got[1:len(got)-1], InvalidId)
	})

	t.Run("test an existing Id", func(t *testing.T) {
		t1 := Task{ID: 1, Title: "Testing", Status: "done"}
		err := a.DB.AddTask(t1)

		request, err := http.NewRequest("DELETE", "/todo/1", nil)
		assertNoError(t, err)

		actualResponse := httptest.NewRecorder()
		a.Router.ServeHTTP(actualResponse, request)

		assertResponseCode(t, actualResponse.Code, 204)

	})

	t.Run("test non existing id", func(t *testing.T) {
		request, err := http.NewRequest("DELETE", "/todo/5", nil)
		assertNoError(t, err)

		actualResponse := sendRequest(request, a)
		assertResponseCode(t, http.StatusNotFound, actualResponse.Code)
		got := actualResponse.Body.String()
		assertResponseBody(t, got[1:len(got)-1], NotFoundMessage)
	})
}

func TestAddTask(t *testing.T) {
	a, container, ctx := SetupDatabaseContainer(t)
	defer container.Terminate(ctx)
	defer a.DB.dbInstance.Close()
	t.Run("test a valid post method", func(t *testing.T) {
		requestBody := []byte(`{"title":"test", "status":"pending"}`)
		request, _ := http.NewRequest("POST", "/todo", bytes.NewBuffer(requestBody))
		request.Header.Set("Content-Type", "application/json")

		actualResponse := sendRequest(request, a)
		assertResponseCode(t, actualResponse.Code, http.StatusCreated)
		got := actualResponse.Body.String()
		assertResponseBody(t, got[1:len(got)-1], TaskCreationSuccessMessage)
	})

	t.Run("test invalid input", func(t *testing.T) {
		requestBody := []byte(`{"title":"   ", "status:"pending"}`)

		request, _ := http.NewRequest("POST", "/todo", bytes.NewBuffer(requestBody))

		request.Header.Set("Content-Type", "application/json")

		actualResponse := sendRequest(request, a)
		assertResponseCode(t, actualResponse.Code, http.StatusBadRequest)

		got := actualResponse.Body.String()

		assertResponseBody(t, got[1:len(got)-1], InvalidTaskInput)
	})

	t.Run("test db failure", func(t *testing.T) {
		requestBody := []byte(`{"title":"test", "status":"pending"}`)

		request, _ := http.NewRequest("POST", "/todo", bytes.NewBuffer(requestBody))
		request.Header.Set("Content-Type", "application/json")
		a.DB.DropTable()

		actualResponse := sendRequest(request, a)
		assertResponseCode(t, actualResponse.Code, 500)
	})
}
