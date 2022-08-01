package main

import (
	"database/sql"
	"fmt"
)

type Task struct {
	ID     int    `json:"id"`
	Title  string `json:"title"`
	Status string `json:"status"`
}

type Database struct {
	dbInstance *sql.DB
}

func NewDatabase(username, password, dbName, host string) *Database {
	d := Database{}
	d.connect(username, password, dbName, host)
	return &d
}

func (db *Database) connect(username, password, dbName, host string) {
	

	var err error
	psqlInfo := fmt.Sprintf("host=%s port=%d user=%s "+
		"password=%s dbname=%s sslmode=disable",
		host, 5432, username, password, dbName)
	db.dbInstance, err = sql.Open("postgres", psqlInfo)
	if err != nil {
		errMsg := fmt.Sprintf("couldn't connect with database with these credentianls{username: %s, password: %s, database name: %s, host: %s}", username, password, dbName, host)
		panic(errMsg)
	}
}

func (db *Database) GetTaskById(id int) (Task, error) {
	task := Task{ID: id}
	err := db.dbInstance.QueryRow("select title, status from task where id = $1", task.ID).Scan(&task.Title, &task.Status)
	return task, err
}
func (db *Database) GetAllTasksByStatus(status string) ([]Task, error) {
	rows, err := db.dbInstance.Query("select id, title, status from task where status = $1", status)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	tasks := []Task{}

	for rows.Next() {
		var task Task
		if err := rows.Scan(&task.ID, &task.Title, &task.Status); err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}

func (db *Database) GetAllTasks() ([]Task, error) {

	rows, err := db.dbInstance.Query("select id, title, status from task")

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	tasks := []Task{}

	for rows.Next() {
		var task Task
		if err := rows.Scan(&task.ID, &task.Title, &task.Status); err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}

	return tasks, nil
}

func (db *Database) DeleteATaskById(id int) error {
	var err error = nil
	_, err = db.dbInstance.Exec("delete from task where id = $1", id)
	return err
}

func (db *Database) AddTask(task Task) error {
	var err error = nil
	_, err = db.dbInstance.Exec("insert into task (title, status) values ($1, $2)", task.Title, task.Status)
	return err
}

func (db *Database) UpdateATaskById(task Task) error {
	var err error = nil
	_, err = db.dbInstance.Exec("UPDATE task SET status=$1 WHERE id=$2", task.Status, task.ID)
	return err
}
