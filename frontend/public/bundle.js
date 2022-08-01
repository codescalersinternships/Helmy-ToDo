
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? requestAnimationFrame : noop;

    const tasks = new Set();
    let running = false;
    function run_tasks() {
        tasks.forEach(task => {
            if (!task[0](now())) {
                tasks.delete(task);
                task[1]();
            }
        });
        running = tasks.size > 0;
        if (running)
            raf(run_tasks);
    }
    function loop(fn) {
        let task;
        if (!running) {
            running = true;
            raf(run_tasks);
        }
        return {
            promise: new Promise(fulfil => {
                tasks.add(task = [fn, fulfil]);
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let stylesheet;
    let active = 0;
    let current_rules = {};
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        if (!current_rules[name]) {
            if (!stylesheet) {
                const style = element('style');
                document.head.appendChild(style);
                stylesheet = style.sheet;
            }
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        node.style.animation = (node.style.animation || '')
            .split(', ')
            .filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        )
            .join(', ');
        if (name && !--active)
            clear_rules();
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            current_rules = {};
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = current_component;
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.shift()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            while (render_callbacks.length) {
                const callback = render_callbacks.pop();
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_render);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_render.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    let outros;
    function group_outros() {
        outros = {
            remaining: 0,
            callbacks: []
        };
    }
    function check_outros() {
        if (!outros.remaining) {
            run_all(outros.callbacks);
        }
    }
    function on_outro(callback) {
        outros.callbacks.push(callback);
    }
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick: tick$$1 = noop, css } = config;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.remaining += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick$$1(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now$$1 => {
                    if (pending_program && now$$1 > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now$$1 >= running_program.end) {
                            tick$$1(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.remaining)
                                        run_all(running_program.group.callbacks);
                                }
                            }
                            running_program = null;
                        }
                        else if (now$$1 >= running_program.start) {
                            const p = now$$1 - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick$$1(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (typeof config === 'function') {
                    wait().then(() => {
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_render } = component.$$;
        fragment.m(target, anchor);
        // onMount happens after the initial afterUpdate. Because
        // afterUpdate callbacks happen in reverse order (inner first)
        // we schedule onMount callbacks before afterUpdate callbacks
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_render.forEach(add_render_callback);
    }
    function destroy(component, detaching) {
        if (component.$$) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal: not_equal$$1,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_render: [],
            after_render: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_render);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                $$.fragment.l(children(options.target));
            }
            else {
                $$.fragment.c();
            }
            if (options.intro && component.$$.fragment.i)
                component.$$.fragment.i();
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy(this, true);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/TodoItem.svelte generated by Svelte v3.4.4 */

    const file = "src/TodoItem.svelte";

    function create_fragment(ctx) {
    	var div3, div1, input, t0, div0, t1, div1_transition, t2, div2, current, dispose;

    	return {
    		c: function create() {
    			div3 = element("div");
    			div1 = element("div");
    			input = element("input");
    			t0 = space();
    			div0 = element("div");
    			t1 = text(ctx.title);
    			t2 = space();
    			div2 = element("div");
    			div2.textContent = "x";
    			attr(input, "type", "checkbox");
    			add_location(input, file, 61, 8, 1202);
    			div0.className = "todo-item-label svelte-18lar83";
    			toggle_class(div0, "completed", ctx.completed);
    			add_location(div0, file, 62, 8, 1286);
    			div1.className = "todo-item-left svelte-18lar83";
    			add_location(div1, file, 60, 4, 1121);
    			div2.className = "remove-item svelte-18lar83";
    			add_location(div2, file, 64, 4, 1372);
    			div3.className = "todo-item svelte-18lar83";
    			add_location(div3, file, 59, 0, 1093);

    			dispose = [
    				listen(input, "change", ctx.input_change_handler),
    				listen(input, "change", ctx.toggleComplete),
    				listen(div2, "click", ctx.deleteTodo)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div3, anchor);
    			append(div3, div1);
    			append(div1, input);

    			input.checked = ctx.completed;

    			append(div1, t0);
    			append(div1, div0);
    			append(div0, t1);
    			append(div3, t2);
    			append(div3, div2);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.completed) input.checked = ctx.completed;

    			if (!current || changed.title) {
    				set_data(t1, ctx.title);
    			}

    			if (changed.completed) {
    				toggle_class(div0, "completed", ctx.completed);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fly, { y: 20, duration: 300 }, true);
    				div1_transition.run(1);
    			});

    			current = true;
    		},

    		o: function outro(local) {
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fly, { y: 20, duration: 300 }, false);
    			div1_transition.run(0);

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div3);
    				if (div1_transition) div1_transition.end();
    			}

    			run_all(dispose);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	

        let { id, title, status } = $$props;
        let completed = status === 'done';
        const dispatch = createEventDispatcher();

        function deleteTodo() {
            dispatch('deleteTodo', {
                id: id
            });
        }

        function toggleComplete() {
            dispatch('toggleComplete', {
                id: id,
                status: status
            });
        }

    	const writable_props = ['id', 'title', 'status'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<TodoItem> was created with unknown prop '${key}'`);
    	});

    	function input_change_handler() {
    		completed = this.checked;
    		$$invalidate('completed', completed);
    	}

    	$$self.$set = $$props => {
    		if ('id' in $$props) $$invalidate('id', id = $$props.id);
    		if ('title' in $$props) $$invalidate('title', title = $$props.title);
    		if ('status' in $$props) $$invalidate('status', status = $$props.status);
    	};

    	return {
    		id,
    		title,
    		status,
    		completed,
    		deleteTodo,
    		toggleComplete,
    		input_change_handler
    	};
    }

    class TodoItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["id", "title", "status"]);

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.id === undefined && !('id' in props)) {
    			console.warn("<TodoItem> was created without expected prop 'id'");
    		}
    		if (ctx.title === undefined && !('title' in props)) {
    			console.warn("<TodoItem> was created without expected prop 'title'");
    		}
    		if (ctx.status === undefined && !('status' in props)) {
    			console.warn("<TodoItem> was created without expected prop 'status'");
    		}
    	}

    	get id() {
    		throw new Error("<TodoItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<TodoItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<TodoItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<TodoItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get status() {
    		throw new Error("<TodoItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set status(value) {
    		throw new Error("<TodoItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Todos.svelte generated by Svelte v3.4.4 */

    const file$1 = "src/Todos.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.todo = list[i];
    	return child_ctx;
    }

    // (145:4) {#each filteredTodos as todo}
    function create_each_block(ctx) {
    	var div, current;

    	var todoitem_spread_levels = [
    		ctx.todo
    	];

    	let todoitem_props = {};
    	for (var i = 0; i < todoitem_spread_levels.length; i += 1) {
    		todoitem_props = assign(todoitem_props, todoitem_spread_levels[i]);
    	}
    	var todoitem = new TodoItem({ props: todoitem_props, $$inline: true });
    	todoitem.$on("deleteTodo", ctx.handleDeleteTodo);
    	todoitem.$on("toggleComplete", ctx.handleToggleComplete);

    	return {
    		c: function create() {
    			div = element("div");
    			todoitem.$$.fragment.c();
    			div.className = "todo-item";
    			add_location(div, file$1, 145, 8, 3132);
    		},

    		m: function mount(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(todoitem, div, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var todoitem_changes = changed.filteredTodos ? get_spread_update(todoitem_spread_levels, [
    				ctx.todo
    			]) : {};
    			todoitem.$set(todoitem_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			todoitem.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			todoitem.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div);
    			}

    			todoitem.$destroy();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	var div2, h2, t1, input, t2, t3, div1, div0, button0, t5, button1, t7, button2, current, dispose;

    	var each_value = ctx.filteredTodos;

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	function outro_block(i, detaching, local) {
    		if (each_blocks[i]) {
    			if (detaching) {
    				on_outro(() => {
    					each_blocks[i].d(detaching);
    					each_blocks[i] = null;
    				});
    			}

    			each_blocks[i].o(local);
    		}
    	}

    	return {
    		c: function create() {
    			div2 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Svelte Todo App";
    			t1 = space();
    			input = element("input");
    			t2 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			div1 = element("div");
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "All";
    			t5 = space();
    			button1 = element("button");
    			button1.textContent = "Active";
    			t7 = space();
    			button2 = element("button");
    			button2.textContent = "Completed";
    			add_location(h2, file$1, 141, 4, 2938);
    			attr(input, "type", "text");
    			input.className = "todo-input svelte-1l7rpl7";
    			input.placeholder = "Insert todo item ...";
    			add_location(input, file$1, 142, 4, 2967);
    			button0.className = "svelte-1l7rpl7";
    			toggle_class(button0, "active", ctx.currentFilter === 'all');
    			add_location(button0, file$1, 154, 12, 3367);
    			button1.className = "svelte-1l7rpl7";
    			toggle_class(button1, "active", ctx.currentFilter === 'active');
    			add_location(button1, file$1, 155, 12, 3478);
    			button2.className = "svelte-1l7rpl7";
    			toggle_class(button2, "active", ctx.currentFilter === 'completed');
    			add_location(button2, file$1, 156, 12, 3598);
    			add_location(div0, file$1, 153, 8, 3349);
    			div1.className = "inner-container svelte-1l7rpl7";
    			add_location(div1, file$1, 152, 4, 3311);
    			div2.className = "container svelte-1l7rpl7";
    			add_location(div2, file$1, 139, 0, 2909);

    			dispose = [
    				listen(input, "input", ctx.input_input_handler),
    				listen(input, "keydown", ctx.addTodo),
    				listen(button0, "click", ctx.click_handler),
    				listen(button1, "click", ctx.click_handler_1),
    				listen(button2, "click", ctx.click_handler_2)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, h2);
    			append(div2, t1);
    			append(div2, input);

    			input.value = ctx.newTodoTitle;

    			append(div2, t2);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append(div2, t3);
    			append(div2, div1);
    			append(div1, div0);
    			append(div0, button0);
    			append(div0, t5);
    			append(div0, button1);
    			append(div0, t7);
    			append(div0, button2);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (changed.newTodoTitle && (input.value !== ctx.newTodoTitle)) input.value = ctx.newTodoTitle;

    			if (changed.filteredTodos || changed.handleDeleteTodo || changed.handleToggleComplete) {
    				each_value = ctx.filteredTodos;

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    						each_blocks[i].i(1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].i(1);
    						each_blocks[i].m(div2, t3);
    					}
    				}

    				group_outros();
    				for (; i < each_blocks.length; i += 1) outro_block(i, 1, 1);
    				check_outros();
    			}

    			if (changed.currentFilter) {
    				toggle_class(button0, "active", ctx.currentFilter === 'all');
    				toggle_class(button1, "active", ctx.currentFilter === 'active');
    				toggle_class(button2, "active", ctx.currentFilter === 'completed');
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			for (var i = 0; i < each_value.length; i += 1) each_blocks[i].i();

    			current = true;
    		},

    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);
    			for (let i = 0; i < each_blocks.length; i += 1) outro_block(i, 0);

    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(div2);
    			}

    			destroy_each(each_blocks, detaching);

    			run_all(dispose);
    		}
    	};
    }

    let baseURL = 'http://localhost:50000/';

    async function PostTodo (title) {
    		const res = await fetch(baseURL+'todo', {
    			method: 'POST',
    			body: JSON.stringify({
    				'title': title,
    				'status' : 'pinned'
    			})
    		});
      }

    async function updateTodo (event) {
    		const res = await fetch(baseURL+'todo/'+event.detail.id, {
    			method: 'PUT',
    			body: JSON.stringify({
    				'status' : toggle(event.detail.status)
    			})
    		});
      }

    function toggle(status) {
          if(status === 'done'){
              status = 'pinned';
          }else{
              status = 'done'; 
          }
          return status
      }

    function instance$1($$self, $$props, $$invalidate) {
    	

        let newTodoTitle = '';
        let currentFilter = 'all';
        let todos = [];
        const getAll = async() => {
            const response = await fetch(baseURL+'home');
            $$invalidate('todos', todos = await response.json());
        };



        onMount(getAll);
        const deleteById = async (event) => {
        event.preventDefault();
        await fetch(baseURL + "todo/"+event.detail.id,{
          method: "DELETE",
        });
        getAll();
      };
        
        function addTodo(event) {
            if (event.key === 'Enter') {
                PostTodo(newTodoTitle);
                $$invalidate('newTodoTitle', newTodoTitle = '');
            }
             getAll();
        }

        function getByStatus(status) {
            let filteredTodos = [];
            for(let i = 0; i < todos.length; i++){
                if (todos[i].status === status){
                    filteredTodos = [...filteredTodos, todos[i]];
                    console.log(todos[i]);
                }
            }
            return filteredTodos
        }

        function updateFilter(newFilter) {
            $$invalidate('currentFilter', currentFilter = newFilter);
            getAll();
        }

        function handleDeleteTodo(event) {
            deleteById(event);
            getAll();
        }

        function handleToggleComplete(event) {
            updateTodo(event);
            getAll();
        }

    	function input_input_handler() {
    		newTodoTitle = this.value;
    		$$invalidate('newTodoTitle', newTodoTitle);
    	}

    	function click_handler() {
    		return updateFilter('all');
    	}

    	function click_handler_1() {
    		return updateFilter('active');
    	}

    	function click_handler_2() {
    		return updateFilter('completed');
    	}

    	let filteredTodos;

    	$$self.$$.update = ($$dirty = { currentFilter: 1, todos: 1 }) => {
    		if ($$dirty.currentFilter || $$dirty.todos) { $$invalidate('filteredTodos', filteredTodos = currentFilter === 'all' ? todos: currentFilter === 'completed'
                ? getByStatus('done')
                : getByStatus('pinned')); }
    	};

    	return {
    		newTodoTitle,
    		currentFilter,
    		addTodo,
    		updateFilter,
    		handleDeleteTodo,
    		handleToggleComplete,
    		filteredTodos,
    		input_input_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	};
    }

    class Todos extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, []);
    	}
    }

    /* src/App.svelte generated by Svelte v3.4.4 */

    function create_fragment$2(ctx) {
    	var current;

    	var todos = new Todos({ $$inline: true });

    	return {
    		c: function create() {
    			todos.$$.fragment.c();
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			mount_component(todos, target, anchor);
    			current = true;
    		},

    		p: noop,

    		i: function intro(local) {
    			if (current) return;
    			todos.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			todos.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			todos.$destroy(detaching);
    		}
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$2, safe_not_equal, []);
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    // {
    // 	"id" : 1,
    // 	"title" : "cood",
    // 	"status" : "pinned"
    // }

    return app;

}());
//# sourceMappingURL=bundle.js.map
