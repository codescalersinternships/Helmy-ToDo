package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func (a *App) GetAllTasksHandler(c *gin.Context) {
	var tasks []Task
	var err error
	tasks, err = a.DB.GetAllTasks()

	if err != nil {
		c.JSON(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, tasks)
}

func (a *App) GetATaskByIdHandler(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))

	if err != nil {
		c.JSON(http.StatusBadRequest, InvalidId)
		return
	}

	task, err := a.DB.GetTaskById(id)

	if err != nil {
		c.JSON(http.StatusNotFound, NotFoundMessage)
		return
	}
	c.JSON(http.StatusOK, task)
}

func (a *App) GetATaskByStatusHandler(c *gin.Context) {
	status := c.Param("status")
	if !statusValue[status] {
		c.JSON(http.StatusBadRequest, InvalidStatus)
		return
	}
	tasks, _ := a.DB.GetAllTasksByStatus(status)

	c.JSON(http.StatusOK, tasks)
}

func (a *App) DeleteTaskHandler(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, InvalidId)
		return
	}

	_, err = a.DB.GetTaskById(id)

	if err != nil {
		c.JSON(http.StatusNotFound, NotFoundMessage)
		return
	}
	err = a.DB.DeleteATaskById(id)
	if err != nil{
		c.AbortWithStatusJSON(500, "Internal Server Error")
		return
	}
	c.JSON(204, nil)
}

func (a *App) AddTaskHandler(c *gin.Context) {
	var task Task
	decoder := json.NewDecoder(c.Request.Body)

	if err := decoder.Decode(&task); err != nil {
		c.JSON(http.StatusBadRequest, InvalidTaskInput)
		return
	}

	defer c.Request.Body.Close()
	if len(strings.TrimSpace(task.Title)) == 0 {
		c.JSON(http.StatusBadRequest, InvalidTaskInput)
		return
	}

	if err := a.DB.AddTask(task); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, TaskCreationSuccessMessage)
}

func (a *App) UpdateTaskHandler(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))

	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var task Task
	decoder := json.NewDecoder(c.Request.Body)

	if err = decoder.Decode(&task); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	defer c.Request.Body.Close()
	task.ID = id

	if err = a.DB.UpdateATaskById(task); err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, task)

}
