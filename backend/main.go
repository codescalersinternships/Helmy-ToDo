package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

type App struct {
	Router *gin.Engine
	DB     *Database
}

func (a *App) Initialize(username, password, dbName, host string) {
	
	a.DB = NewDatabase(username, password, dbName, host)
	err := a.DB.CreateTableIfNotExists()
	if err != nil{
		panic(fmt.Sprint("Table creation error: ", err))
	}
	a.Router = gin.Default()
	a.Router.Use(LoggerMiddleware())
	a.Router.Use(CORSMiddleware())
	a.SetupRoutes()
}

func (a *App) SetupRoutes() {
	a.Router.GET("/home", a.GetAllTasksHandler)
	a.Router.GET("/todo/:id", a.GetATaskByIdHandler)
	a.Router.GET("/todo/status/:status", a.GetATaskByStatusHandler)
	a.Router.POST("/todo", a.AddTaskHandler)
	a.Router.PUT("todo/:id", a.UpdateTaskHandler)
	a.Router.DELETE("todo/:id", a.DeleteTaskHandler)
	
}

func main() {
	DB_USER := os.Getenv("DB_USER")
	DB_PASSWORD := os.Getenv("DB_PASSWORD")
	DB_NAME := os.Getenv("DB_NAME")
	DB_HOST := os.Getenv("DB_HOST")
	var a App

	a.Initialize(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST)
	srv := &http.Server{
		Addr:    ":50000",
		Handler: a.Router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutdown Server ...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server Shutdown:", err)
	}
	select {
	case <-ctx.Done():
		log.Println("timeout of 5 seconds.")
	}
	log.Println("Server exiting")
}
