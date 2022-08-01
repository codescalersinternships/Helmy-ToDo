<script>
    import { onMount } from 'svelte';
    import TodoItem from './TodoItem.svelte';

    let newTodoTitle = '';
    let currentFilter = 'all';
    let nextId = 1;
    let baseURL = 'http://localhost:50000/'
    let todos = []
    const getAll = async() => {
        const response = await fetch(baseURL+'home')
        todos = await response.json()
    }



    onMount(getAll)

    async function PostTodo (title) {
		const res = await fetch(baseURL+'todo', {
			method: 'POST',
			body: JSON.stringify({
				'title': title,
				'status' : 'pinned'
			})
		})
    }

    async function updateTodo (event) {
		const res = await fetch(baseURL+'todo/'+event.detail.id, {
			method: 'PUT',
			body: JSON.stringify({
				'status' : toggle(event.detail.status)
			})
		})
    }
    const deleteById = async (event) => {
    event.preventDefault()
    await fetch(baseURL + "todo/"+event.detail.id,{
      method: "DELETE",
    })
    getAll()
  }
    
    function addTodo(event) {
        if (event.key === 'Enter') {
            PostTodo(newTodoTitle)

            nextId = nextId + 1;
            newTodoTitle = '';
        }
         getAll()
    }

    function getByStatus(status) {
        let filteredTodos = []
        for(let i = 0; i < todos.length; i++){
            if (todos[i].status === status){
                filteredTodos = [...filteredTodos, todos[i]]
                console.log(todos[i])
            }
        }
        return filteredTodos
    }
        
   
    
    $: filteredTodos = currentFilter === 'all' ? todos: currentFilter === 'completed'
        ? getByStatus('done')
        : getByStatus('pinned')

    function updateFilter(newFilter) {
        currentFilter = newFilter;
        getAll()
    }

    function handleDeleteTodo(event) {
        deleteById(event)
        getAll()
    }

    function toggle(status) {
        if(status === 'done'){
            status = 'pinned'
        }else{
            status = 'done' 
        }
        return status
    }

    function handleToggleComplete(event) {
        updateTodo(event)
        getAll()
    }

</script>

<style>
    .container {
        max-width: 800px;
        margin: 10px auto;
    }
    .todo-input {
        width: 100%;
        padding: 10px, 20px;
        font-size: 18px;
        margin-bottom: 20px;
    }
    .inner-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 16px;
        border-top: 1px solid lightgrey;
        padding-top: 15px;
        margin-bottom: 13px;
    }
    /* .inner-container-input {
        margin-right: 12px;
    } */

    button {
        font-size: 14px;
        background-color: white;
        appearance: none;
    }

    button:hover {
        background: lightseagreen;
    }

    button:focus {
        outline: none;
    }

    .active {
        background: lightseagreen;
    }
</style>

<div class="container">

    <h2>Svelte Todo App</h2>
    <input type="text" class="todo-input" placeholder="Insert todo item ..." bind:value={newTodoTitle} on:keydown={addTodo}>

    {#each filteredTodos as todo}
        <div class="todo-item">
            
            <TodoItem {...todo} on:deleteTodo={handleDeleteTodo} on:toggleComplete={handleToggleComplete} />
        </div>
    {/each}


    <div class="inner-container">
        <div>
            <button on:click={() => updateFilter('all')} class:active="{currentFilter === 'all'}">All</button>
            <button on:click={() => updateFilter('active')} class:active="{currentFilter === 'active'}">Active</button>
            <button on:click={() => updateFilter('completed')} class:active="{currentFilter === 'completed'}">Completed</button>
        </div>
    </div>

</div>