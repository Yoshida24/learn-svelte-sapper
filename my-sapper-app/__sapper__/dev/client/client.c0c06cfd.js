function noop() { }
function assign(tar, src) {
    // @ts-ignore
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
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
    if (slot_changes) {
        const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
        slot.p(slot_context, slot_changes);
    }
}
function get_all_dirty_from_scope($$scope) {
    if ($$scope.ctx.length > 32) {
        const dirty = [];
        const length = $$scope.ctx.length / 32;
        for (let i = 0; i < length; i++) {
            dirty[i] = -1;
        }
        return dirty;
    }
    return -1;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
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
function empty() {
    return text('');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function custom_event(type, detail, bubbles = false) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, bubbles, false, detail);
    return e;
}
function query_selector_all(selector, parent = document.body) {
    return Array.from(parent.querySelectorAll(selector));
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function afterUpdate(fn) {
    get_current_component().$$.after_update.push(fn);
}
function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}

const globals = (typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
        ? globalThis
        : global);

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
function get_spread_object(spread_props) {
    return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
}
function create_component(block) {
    block && block.c();
}
function claim_component(block, parent_nodes) {
    block && block.l(parent_nodes);
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
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
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init$1(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
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
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

function dispatch_dev(type, detail) {
    document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.2' }, detail), true));
}
function append_hydration_dev(target, node) {
    dispatch_dev('SvelteDOMInsert', { target, node });
    append_hydration(target, node);
}
function insert_hydration_dev(target, node, anchor) {
    dispatch_dev('SvelteDOMInsert', { target, node, anchor });
    insert_hydration(target, node, anchor);
}
function detach_dev(node) {
    dispatch_dev('SvelteDOMRemove', { node });
    detach(node);
}
function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
        dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
    else
        dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
}
function set_data_dev(text, data) {
    data = '' + data;
    if (text.wholeText === data)
        return;
    dispatch_dev('SvelteDOMSetData', { node: text, data });
    text.data = data;
}
function validate_each_argument(arg) {
    if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
        let msg = '{#each} only iterates over array-like objects.';
        if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
            msg += ' You can use a spread to convert this iterable into an array.';
        }
        throw new Error(msg);
    }
}
function validate_slots(name, slot, keys) {
    for (const slot_key of Object.keys(slot)) {
        if (!~keys.indexOf(slot_key)) {
            console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
        }
    }
}
/**
 * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
 */
class SvelteComponentDev extends SvelteComponent {
    constructor(options) {
        if (!options || (!options.target && !options.$$inline)) {
            throw new Error("'target' is a required option");
        }
        super();
    }
    $destroy() {
        super.$destroy();
        this.$destroy = () => {
            console.warn('Component was already destroyed'); // eslint-disable-line no-console
        };
    }
    $capture_state() { }
    $inject_state() { }
}

const subscriber_queue = [];
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = new Set();
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (const subscriber of subscribers) {
                    subscriber[1]();
                    subscriber_queue.push(subscriber, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.add(subscriber);
        if (subscribers.size === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            subscribers.delete(subscriber);
            if (subscribers.size === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}

const CONTEXT_KEY = {};

/* src/components/Nav.svelte generated by Svelte v3.44.2 */

const file$2 = "src/components/Nav.svelte";

function create_fragment$3(ctx) {
	let nav;
	let ul;
	let li0;
	let a0;
	let t0;
	let a0_aria_current_value;
	let t1;
	let li1;
	let a1;
	let t2;
	let a1_aria_current_value;
	let t3;
	let li2;
	let a2;
	let t4;
	let a2_aria_current_value;

	const block = {
		c: function create() {
			nav = element("nav");
			ul = element("ul");
			li0 = element("li");
			a0 = element("a");
			t0 = text("home");
			t1 = space();
			li1 = element("li");
			a1 = element("a");
			t2 = text("about");
			t3 = space();
			li2 = element("li");
			a2 = element("a");
			t4 = text("blog");
			this.h();
		},
		l: function claim(nodes) {
			nav = claim_element(nodes, "NAV", { class: true });
			var nav_nodes = children(nav);
			ul = claim_element(nav_nodes, "UL", { class: true });
			var ul_nodes = children(ul);
			li0 = claim_element(ul_nodes, "LI", { class: true });
			var li0_nodes = children(li0);

			a0 = claim_element(li0_nodes, "A", {
				"aria-current": true,
				href: true,
				class: true
			});

			var a0_nodes = children(a0);
			t0 = claim_text(a0_nodes, "home");
			a0_nodes.forEach(detach_dev);
			li0_nodes.forEach(detach_dev);
			t1 = claim_space(ul_nodes);
			li1 = claim_element(ul_nodes, "LI", { class: true });
			var li1_nodes = children(li1);

			a1 = claim_element(li1_nodes, "A", {
				"aria-current": true,
				href: true,
				class: true
			});

			var a1_nodes = children(a1);
			t2 = claim_text(a1_nodes, "about");
			a1_nodes.forEach(detach_dev);
			li1_nodes.forEach(detach_dev);
			t3 = claim_space(ul_nodes);
			li2 = claim_element(ul_nodes, "LI", { class: true });
			var li2_nodes = children(li2);

			a2 = claim_element(li2_nodes, "A", {
				rel: true,
				"aria-current": true,
				href: true,
				class: true
			});

			var a2_nodes = children(a2);
			t4 = claim_text(a2_nodes, "blog");
			a2_nodes.forEach(detach_dev);
			li2_nodes.forEach(detach_dev);
			ul_nodes.forEach(detach_dev);
			nav_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(a0, "aria-current", a0_aria_current_value = /*segment*/ ctx[0] === undefined ? 'page' : undefined);
			attr_dev(a0, "href", ".");
			attr_dev(a0, "class", "svelte-1dbd5up");
			add_location(a0, file$2, 52, 6, 653);
			attr_dev(li0, "class", "svelte-1dbd5up");
			add_location(li0, file$2, 52, 2, 649);
			attr_dev(a1, "aria-current", a1_aria_current_value = /*segment*/ ctx[0] === 'about' ? 'page' : undefined);
			attr_dev(a1, "href", "about");
			attr_dev(a1, "class", "svelte-1dbd5up");
			add_location(a1, file$2, 53, 6, 745);
			attr_dev(li1, "class", "svelte-1dbd5up");
			add_location(li1, file$2, 53, 2, 741);
			attr_dev(a2, "rel", "prefetch");
			attr_dev(a2, "aria-current", a2_aria_current_value = /*segment*/ ctx[0] === 'blog' ? 'page' : undefined);
			attr_dev(a2, "href", "blog");
			attr_dev(a2, "class", "svelte-1dbd5up");
			add_location(a2, file$2, 57, 6, 998);
			attr_dev(li2, "class", "svelte-1dbd5up");
			add_location(li2, file$2, 57, 2, 994);
			attr_dev(ul, "class", "svelte-1dbd5up");
			add_location(ul, file$2, 51, 1, 642);
			attr_dev(nav, "class", "svelte-1dbd5up");
			add_location(nav, file$2, 50, 0, 635);
		},
		m: function mount(target, anchor) {
			insert_hydration_dev(target, nav, anchor);
			append_hydration_dev(nav, ul);
			append_hydration_dev(ul, li0);
			append_hydration_dev(li0, a0);
			append_hydration_dev(a0, t0);
			append_hydration_dev(ul, t1);
			append_hydration_dev(ul, li1);
			append_hydration_dev(li1, a1);
			append_hydration_dev(a1, t2);
			append_hydration_dev(ul, t3);
			append_hydration_dev(ul, li2);
			append_hydration_dev(li2, a2);
			append_hydration_dev(a2, t4);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*segment*/ 1 && a0_aria_current_value !== (a0_aria_current_value = /*segment*/ ctx[0] === undefined ? 'page' : undefined)) {
				attr_dev(a0, "aria-current", a0_aria_current_value);
			}

			if (dirty & /*segment*/ 1 && a1_aria_current_value !== (a1_aria_current_value = /*segment*/ ctx[0] === 'about' ? 'page' : undefined)) {
				attr_dev(a1, "aria-current", a1_aria_current_value);
			}

			if (dirty & /*segment*/ 1 && a2_aria_current_value !== (a2_aria_current_value = /*segment*/ ctx[0] === 'blog' ? 'page' : undefined)) {
				attr_dev(a2, "aria-current", a2_aria_current_value);
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(nav);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$3.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$3($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots('Nav', slots, []);
	let { segment } = $$props;
	const writable_props = ['segment'];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Nav> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ('segment' in $$props) $$invalidate(0, segment = $$props.segment);
	};

	$$self.$capture_state = () => ({ segment });

	$$self.$inject_state = $$props => {
		if ('segment' in $$props) $$invalidate(0, segment = $$props.segment);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [segment];
}

class Nav extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$3, create_fragment$3, safe_not_equal, { segment: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Nav",
			options,
			id: create_fragment$3.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*segment*/ ctx[0] === undefined && !('segment' in props)) {
			console.warn("<Nav> was created without expected prop 'segment'");
		}
	}

	get segment() {
		throw new Error("<Nav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set segment(value) {
		throw new Error("<Nav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/routes/_layout.svelte generated by Svelte v3.44.2 */
const file$1 = "src/routes/_layout.svelte";

function create_fragment$2(ctx) {
	let nav;
	let t;
	let main;
	let current;

	nav = new Nav({
			props: { segment: /*segment*/ ctx[0] },
			$$inline: true
		});

	const default_slot_template = /*#slots*/ ctx[2].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

	const block = {
		c: function create() {
			create_component(nav.$$.fragment);
			t = space();
			main = element("main");
			if (default_slot) default_slot.c();
			this.h();
		},
		l: function claim(nodes) {
			claim_component(nav.$$.fragment, nodes);
			t = claim_space(nodes);
			main = claim_element(nodes, "MAIN", { class: true });
			var main_nodes = children(main);
			if (default_slot) default_slot.l(main_nodes);
			main_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			attr_dev(main, "class", "svelte-1uhnsl8");
			add_location(main, file$1, 19, 0, 262);
		},
		m: function mount(target, anchor) {
			mount_component(nav, target, anchor);
			insert_hydration_dev(target, t, anchor);
			insert_hydration_dev(target, main, anchor);

			if (default_slot) {
				default_slot.m(main, null);
			}

			current = true;
		},
		p: function update(ctx, [dirty]) {
			const nav_changes = {};
			if (dirty & /*segment*/ 1) nav_changes.segment = /*segment*/ ctx[0];
			nav.$set(nav_changes);

			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[1],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
						null
					);
				}
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(nav.$$.fragment, local);
			transition_in(default_slot, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(nav.$$.fragment, local);
			transition_out(default_slot, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(nav, detaching);
			if (detaching) detach_dev(t);
			if (detaching) detach_dev(main);
			if (default_slot) default_slot.d(detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$2.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$2($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots('Layout', slots, ['default']);
	let { segment } = $$props;
	const writable_props = ['segment'];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Layout> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ('segment' in $$props) $$invalidate(0, segment = $$props.segment);
		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
	};

	$$self.$capture_state = () => ({ Nav, segment });

	$$self.$inject_state = $$props => {
		if ('segment' in $$props) $$invalidate(0, segment = $$props.segment);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [segment, $$scope, slots];
}

class Layout extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$2, create_fragment$2, safe_not_equal, { segment: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Layout",
			options,
			id: create_fragment$2.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*segment*/ ctx[0] === undefined && !('segment' in props)) {
			console.warn("<Layout> was created without expected prop 'segment'");
		}
	}

	get segment() {
		throw new Error("<Layout>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set segment(value) {
		throw new Error("<Layout>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/routes/_error.svelte generated by Svelte v3.44.2 */

const { Error: Error_1$1 } = globals;
const file = "src/routes/_error.svelte";

// (38:0) {#if dev && error.stack}
function create_if_block$1(ctx) {
	let pre;
	let t_value = /*error*/ ctx[1].stack + "";
	let t;

	const block = {
		c: function create() {
			pre = element("pre");
			t = text(t_value);
			this.h();
		},
		l: function claim(nodes) {
			pre = claim_element(nodes, "PRE", {});
			var pre_nodes = children(pre);
			t = claim_text(pre_nodes, t_value);
			pre_nodes.forEach(detach_dev);
			this.h();
		},
		h: function hydrate() {
			add_location(pre, file, 38, 1, 443);
		},
		m: function mount(target, anchor) {
			insert_hydration_dev(target, pre, anchor);
			append_hydration_dev(pre, t);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*error*/ 2 && t_value !== (t_value = /*error*/ ctx[1].stack + "")) set_data_dev(t, t_value);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(pre);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$1.name,
		type: "if",
		source: "(38:0) {#if dev && error.stack}",
		ctx
	});

	return block;
}

function create_fragment$1(ctx) {
	let title_value;
	let t0;
	let h1;
	let t1;
	let t2;
	let p;
	let t3_value = /*error*/ ctx[1].message + "";
	let t3;
	let t4;
	let if_block_anchor;
	document.title = title_value = /*status*/ ctx[0];
	let if_block = /*dev*/ ctx[2] && /*error*/ ctx[1].stack && create_if_block$1(ctx);

	const block = {
		c: function create() {
			t0 = space();
			h1 = element("h1");
			t1 = text(/*status*/ ctx[0]);
			t2 = space();
			p = element("p");
			t3 = text(t3_value);
			t4 = space();
			if (if_block) if_block.c();
			if_block_anchor = empty();
			this.h();
		},
		l: function claim(nodes) {
			const head_nodes = query_selector_all('[data-svelte=\"svelte-1o9r2ue\"]', document.head);
			head_nodes.forEach(detach_dev);
			t0 = claim_space(nodes);
			h1 = claim_element(nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t1 = claim_text(h1_nodes, /*status*/ ctx[0]);
			h1_nodes.forEach(detach_dev);
			t2 = claim_space(nodes);
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t3 = claim_text(p_nodes, t3_value);
			p_nodes.forEach(detach_dev);
			t4 = claim_space(nodes);
			if (if_block) if_block.l(nodes);
			if_block_anchor = empty();
			this.h();
		},
		h: function hydrate() {
			attr_dev(h1, "class", "svelte-8od9u6");
			add_location(h1, file, 33, 0, 374);
			attr_dev(p, "class", "svelte-8od9u6");
			add_location(p, file, 35, 0, 393);
		},
		m: function mount(target, anchor) {
			insert_hydration_dev(target, t0, anchor);
			insert_hydration_dev(target, h1, anchor);
			append_hydration_dev(h1, t1);
			insert_hydration_dev(target, t2, anchor);
			insert_hydration_dev(target, p, anchor);
			append_hydration_dev(p, t3);
			insert_hydration_dev(target, t4, anchor);
			if (if_block) if_block.m(target, anchor);
			insert_hydration_dev(target, if_block_anchor, anchor);
		},
		p: function update(ctx, [dirty]) {
			if (dirty & /*status*/ 1 && title_value !== (title_value = /*status*/ ctx[0])) {
				document.title = title_value;
			}

			if (dirty & /*status*/ 1) set_data_dev(t1, /*status*/ ctx[0]);
			if (dirty & /*error*/ 2 && t3_value !== (t3_value = /*error*/ ctx[1].message + "")) set_data_dev(t3, t3_value);

			if (/*dev*/ ctx[2] && /*error*/ ctx[1].stack) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block$1(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(t0);
			if (detaching) detach_dev(h1);
			if (detaching) detach_dev(t2);
			if (detaching) detach_dev(p);
			if (detaching) detach_dev(t4);
			if (if_block) if_block.d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$1.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$1($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots('Error', slots, []);
	let { status } = $$props;
	let { error } = $$props;
	const dev = "development" === 'development';
	const writable_props = ['status', 'error'];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Error> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ('status' in $$props) $$invalidate(0, status = $$props.status);
		if ('error' in $$props) $$invalidate(1, error = $$props.error);
	};

	$$self.$capture_state = () => ({ status, error, dev });

	$$self.$inject_state = $$props => {
		if ('status' in $$props) $$invalidate(0, status = $$props.status);
		if ('error' in $$props) $$invalidate(1, error = $$props.error);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [status, error, dev];
}

class Error$1 extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init$1(this, options, instance$1, create_fragment$1, safe_not_equal, { status: 0, error: 1 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Error",
			options,
			id: create_fragment$1.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*status*/ ctx[0] === undefined && !('status' in props)) {
			console.warn("<Error> was created without expected prop 'status'");
		}

		if (/*error*/ ctx[1] === undefined && !('error' in props)) {
			console.warn("<Error> was created without expected prop 'error'");
		}
	}

	get status() {
		throw new Error_1$1("<Error>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set status(value) {
		throw new Error_1$1("<Error>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get error() {
		throw new Error_1$1("<Error>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set error(value) {
		throw new Error_1$1("<Error>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/node_modules/@sapper/internal/App.svelte generated by Svelte v3.44.2 */

const { Error: Error_1 } = globals;

// (23:1) {:else}
function create_else_block(ctx) {
	let switch_instance;
	let switch_instance_anchor;
	let current;
	const switch_instance_spread_levels = [/*level1*/ ctx[4].props];
	var switch_value = /*level1*/ ctx[4].component;

	function switch_props(ctx) {
		let switch_instance_props = {};

		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
		}

		return {
			props: switch_instance_props,
			$$inline: true
		};
	}

	if (switch_value) {
		switch_instance = new switch_value(switch_props());
	}

	const block = {
		c: function create() {
			if (switch_instance) create_component(switch_instance.$$.fragment);
			switch_instance_anchor = empty();
		},
		l: function claim(nodes) {
			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
			switch_instance_anchor = empty();
		},
		m: function mount(target, anchor) {
			if (switch_instance) {
				mount_component(switch_instance, target, anchor);
			}

			insert_hydration_dev(target, switch_instance_anchor, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const switch_instance_changes = (dirty & /*level1*/ 16)
			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*level1*/ ctx[4].props)])
			: {};

			if (switch_value !== (switch_value = /*level1*/ ctx[4].component)) {
				if (switch_instance) {
					group_outros();
					const old_component = switch_instance;

					transition_out(old_component.$$.fragment, 1, 0, () => {
						destroy_component(old_component, 1);
					});

					check_outros();
				}

				if (switch_value) {
					switch_instance = new switch_value(switch_props());
					create_component(switch_instance.$$.fragment);
					transition_in(switch_instance.$$.fragment, 1);
					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
				} else {
					switch_instance = null;
				}
			} else if (switch_value) {
				switch_instance.$set(switch_instance_changes);
			}
		},
		i: function intro(local) {
			if (current) return;
			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(switch_instance_anchor);
			if (switch_instance) destroy_component(switch_instance, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block.name,
		type: "else",
		source: "(23:1) {:else}",
		ctx
	});

	return block;
}

// (21:1) {#if error}
function create_if_block(ctx) {
	let error_1;
	let current;

	error_1 = new Error$1({
			props: {
				error: /*error*/ ctx[0],
				status: /*status*/ ctx[1]
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			create_component(error_1.$$.fragment);
		},
		l: function claim(nodes) {
			claim_component(error_1.$$.fragment, nodes);
		},
		m: function mount(target, anchor) {
			mount_component(error_1, target, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			const error_1_changes = {};
			if (dirty & /*error*/ 1) error_1_changes.error = /*error*/ ctx[0];
			if (dirty & /*status*/ 2) error_1_changes.status = /*status*/ ctx[1];
			error_1.$set(error_1_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(error_1.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(error_1.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(error_1, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(21:1) {#if error}",
		ctx
	});

	return block;
}

// (20:0) <Layout segment="{segments[0]}" {...level0.props}>
function create_default_slot(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*error*/ ctx[0]) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	const block = {
		c: function create() {
			if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			if_block.l(nodes);
			if_block_anchor = empty();
		},
		m: function mount(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert_hydration_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_default_slot.name,
		type: "slot",
		source: "(20:0) <Layout segment=\\\"{segments[0]}\\\" {...level0.props}>",
		ctx
	});

	return block;
}

function create_fragment(ctx) {
	let layout;
	let current;
	const layout_spread_levels = [{ segment: /*segments*/ ctx[2][0] }, /*level0*/ ctx[3].props];

	let layout_props = {
		$$slots: { default: [create_default_slot] },
		$$scope: { ctx }
	};

	for (let i = 0; i < layout_spread_levels.length; i += 1) {
		layout_props = assign(layout_props, layout_spread_levels[i]);
	}

	layout = new Layout({ props: layout_props, $$inline: true });

	const block = {
		c: function create() {
			create_component(layout.$$.fragment);
		},
		l: function claim(nodes) {
			claim_component(layout.$$.fragment, nodes);
		},
		m: function mount(target, anchor) {
			mount_component(layout, target, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			const layout_changes = (dirty & /*segments, level0*/ 12)
			? get_spread_update(layout_spread_levels, [
					dirty & /*segments*/ 4 && { segment: /*segments*/ ctx[2][0] },
					dirty & /*level0*/ 8 && get_spread_object(/*level0*/ ctx[3].props)
				])
			: {};

			if (dirty & /*$$scope, error, status, level1*/ 147) {
				layout_changes.$$scope = { dirty, ctx };
			}

			layout.$set(layout_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(layout.$$.fragment, local);
			current = true;
		},
		o: function outro(local) {
			transition_out(layout.$$.fragment, local);
			current = false;
		},
		d: function destroy(detaching) {
			destroy_component(layout, detaching);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots('App', slots, []);
	let { stores } = $$props;
	let { error } = $$props;
	let { status } = $$props;
	let { segments } = $$props;
	let { level0 } = $$props;
	let { level1 = null } = $$props;
	let { notify } = $$props;
	afterUpdate(notify);
	setContext(CONTEXT_KEY, stores);
	const writable_props = ['stores', 'error', 'status', 'segments', 'level0', 'level1', 'notify'];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
	});

	$$self.$$set = $$props => {
		if ('stores' in $$props) $$invalidate(5, stores = $$props.stores);
		if ('error' in $$props) $$invalidate(0, error = $$props.error);
		if ('status' in $$props) $$invalidate(1, status = $$props.status);
		if ('segments' in $$props) $$invalidate(2, segments = $$props.segments);
		if ('level0' in $$props) $$invalidate(3, level0 = $$props.level0);
		if ('level1' in $$props) $$invalidate(4, level1 = $$props.level1);
		if ('notify' in $$props) $$invalidate(6, notify = $$props.notify);
	};

	$$self.$capture_state = () => ({
		setContext,
		afterUpdate,
		CONTEXT_KEY,
		Layout,
		Error: Error$1,
		stores,
		error,
		status,
		segments,
		level0,
		level1,
		notify
	});

	$$self.$inject_state = $$props => {
		if ('stores' in $$props) $$invalidate(5, stores = $$props.stores);
		if ('error' in $$props) $$invalidate(0, error = $$props.error);
		if ('status' in $$props) $$invalidate(1, status = $$props.status);
		if ('segments' in $$props) $$invalidate(2, segments = $$props.segments);
		if ('level0' in $$props) $$invalidate(3, level0 = $$props.level0);
		if ('level1' in $$props) $$invalidate(4, level1 = $$props.level1);
		if ('notify' in $$props) $$invalidate(6, notify = $$props.notify);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [error, status, segments, level0, level1, stores, notify];
}

class App extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init$1(this, options, instance, create_fragment, safe_not_equal, {
			stores: 5,
			error: 0,
			status: 1,
			segments: 2,
			level0: 3,
			level1: 4,
			notify: 6
		});

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "App",
			options,
			id: create_fragment.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*stores*/ ctx[5] === undefined && !('stores' in props)) {
			console.warn("<App> was created without expected prop 'stores'");
		}

		if (/*error*/ ctx[0] === undefined && !('error' in props)) {
			console.warn("<App> was created without expected prop 'error'");
		}

		if (/*status*/ ctx[1] === undefined && !('status' in props)) {
			console.warn("<App> was created without expected prop 'status'");
		}

		if (/*segments*/ ctx[2] === undefined && !('segments' in props)) {
			console.warn("<App> was created without expected prop 'segments'");
		}

		if (/*level0*/ ctx[3] === undefined && !('level0' in props)) {
			console.warn("<App> was created without expected prop 'level0'");
		}

		if (/*notify*/ ctx[6] === undefined && !('notify' in props)) {
			console.warn("<App> was created without expected prop 'notify'");
		}
	}

	get stores() {
		throw new Error_1("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set stores(value) {
		throw new Error_1("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get error() {
		throw new Error_1("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set error(value) {
		throw new Error_1("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get status() {
		throw new Error_1("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set status(value) {
		throw new Error_1("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get segments() {
		throw new Error_1("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set segments(value) {
		throw new Error_1("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get level0() {
		throw new Error_1("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set level0(value) {
		throw new Error_1("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get level1() {
		throw new Error_1("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set level1(value) {
		throw new Error_1("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get notify() {
		throw new Error_1("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set notify(value) {
		throw new Error_1("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

// This file is generated by Sapper ??? do not edit it!

const ignore = [/^\/blog\.json$/, /^\/blog\/([^/]+?)\.json$/];

const components = [
	{
		js: () => Promise.all([import('./index.b9e4b59a.js'), __inject_styles(["client-e118e612.css","index-39716d32.css"])]).then(function(x) { return x[0]; })
	},
	{
		js: () => Promise.all([import('./about.e882e3c1.js'), __inject_styles(["client-e118e612.css"])]).then(function(x) { return x[0]; })
	},
	{
		js: () => Promise.all([import('./index.c92507d9.js'), __inject_styles(["client-e118e612.css","index-7ed37c94.css"])]).then(function(x) { return x[0]; })
	},
	{
		js: () => Promise.all([import('./_slug_.a1b6dd09.js'), __inject_styles(["client-e118e612.css","_slug_-5bc8f95f.css"])]).then(function(x) { return x[0]; })
	}
];

const routes = (d => [
	{
		// index.svelte
		pattern: /^\/$/,
		parts: [
			{ i: 0 }
		]
	},

	{
		// about.svelte
		pattern: /^\/about\/?$/,
		parts: [
			{ i: 1 }
		]
	},

	{
		// blog/index.svelte
		pattern: /^\/blog\/?$/,
		parts: [
			{ i: 2 }
		]
	},

	{
		// blog/[slug].svelte
		pattern: /^\/blog\/([^/]+?)\/?$/,
		parts: [
			null,
			{ i: 3, params: match => ({ slug: d(match[1]) }) }
		]
	}
])(decodeURIComponent);

if (typeof window !== 'undefined') {
	Promise.all([import('./sapper-dev-client.1e7a4a5e.js'), ]).then(function(x) { return x[0]; }).then(client => {
		client.connect(10000);
	});
}

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function find_anchor(node) {
    while (node && node.nodeName.toUpperCase() !== 'A')
        node = node.parentNode; // SVG <a> elements have a lowercase name
    return node;
}

let uid = 1;
function set_uid(n) {
    uid = n;
}
let cid;
function set_cid(n) {
    cid = n;
}
const _history = typeof history !== 'undefined' ? history : {
    pushState: () => { },
    replaceState: () => { },
    scrollRestoration: 'auto'
};
const scroll_history = {};
function load_current_page() {
    return Promise.resolve().then(() => {
        const { hash, href } = location;
        _history.replaceState({ id: uid }, '', href);
        const target = select_target(new URL(location.href));
        if (target)
            return navigate(target, uid, true, hash);
    });
}
let base_url;
let handle_target;
function init(base, handler) {
    base_url = base;
    handle_target = handler;
    if ('scrollRestoration' in _history) {
        _history.scrollRestoration = 'manual';
    }
    // Adopted from Nuxt.js
    // Reset scrollRestoration to auto when leaving page, allowing page reload
    // and back-navigation from other pages to use the browser to restore the
    // scrolling position.
    addEventListener('beforeunload', () => {
        _history.scrollRestoration = 'auto';
    });
    // Setting scrollRestoration to manual again when returning to this page.
    addEventListener('load', () => {
        _history.scrollRestoration = 'manual';
    });
    addEventListener('click', handle_click);
    addEventListener('popstate', handle_popstate);
}
function extract_query(search) {
    const query = Object.create(null);
    if (search.length > 0) {
        search.slice(1).split('&').forEach(searchParam => {
            const [, key, value = ''] = /([^=]*)(?:=(.*))?/.exec(decodeURIComponent(searchParam.replace(/\+/g, ' ')));
            if (typeof query[key] === 'string')
                query[key] = [query[key]];
            if (typeof query[key] === 'object')
                query[key].push(value);
            else
                query[key] = value;
        });
    }
    return query;
}
function select_target(url) {
    if (url.origin !== location.origin)
        return null;
    if (!url.pathname.startsWith(base_url))
        return null;
    let path = url.pathname.slice(base_url.length);
    if (path === '') {
        path = '/';
    }
    // avoid accidental clashes between server routes and page routes
    if (ignore.some(pattern => pattern.test(path)))
        return;
    for (let i = 0; i < routes.length; i += 1) {
        const route = routes[i];
        const match = route.pattern.exec(path);
        if (match) {
            const query = extract_query(url.search);
            const part = route.parts[route.parts.length - 1];
            const params = part.params ? part.params(match) : {};
            const page = { host: location.host, path, query, params };
            return { href: url.href, route, match, page };
        }
    }
}
function handle_click(event) {
    // Adapted from https://github.com/visionmedia/page.js
    // MIT license https://github.com/visionmedia/page.js#license
    if (which(event) !== 1)
        return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
    if (event.defaultPrevented)
        return;
    const a = find_anchor(event.target);
    if (!a)
        return;
    if (!a.href)
        return;
    // check if link is inside an svg
    // in this case, both href and target are always inside an object
    const svg = typeof a.href === 'object' && a.href.constructor.name === 'SVGAnimatedString';
    const href = String(svg ? a.href.baseVal : a.href);
    if (href === location.href) {
        if (!location.hash)
            event.preventDefault();
        return;
    }
    // Ignore if tag has
    // 1. 'download' attribute
    // 2. rel='external' attribute
    if (a.hasAttribute('download') || a.getAttribute('rel') === 'external')
        return;
    // Ignore if <a> has a target
    if (svg ? a.target.baseVal : a.target)
        return;
    const url = new URL(href);
    // Don't handle hash changes
    if (url.pathname === location.pathname && url.search === location.search)
        return;
    const target = select_target(url);
    if (target) {
        const noscroll = a.hasAttribute('sapper:noscroll');
        navigate(target, null, noscroll, url.hash);
        event.preventDefault();
        _history.pushState({ id: cid }, '', url.href);
    }
}
function which(event) {
    return event.which === null ? event.button : event.which;
}
function scroll_state() {
    return {
        x: pageXOffset,
        y: pageYOffset
    };
}
function handle_popstate(event) {
    scroll_history[cid] = scroll_state();
    if (event.state) {
        const url = new URL(location.href);
        const target = select_target(url);
        if (target) {
            navigate(target, event.state.id);
        }
        else {
            // eslint-disable-next-line
            location.href = location.href; // nosonar
        }
    }
    else {
        // hashchange
        set_uid(uid + 1);
        set_cid(uid);
        _history.replaceState({ id: cid }, '', location.href);
    }
}
function navigate(dest, id, noscroll, hash) {
    return __awaiter(this, void 0, void 0, function* () {
        const popstate = !!id;
        if (popstate) {
            cid = id;
        }
        else {
            const current_scroll = scroll_state();
            // clicked on a link. preserve scroll state
            scroll_history[cid] = current_scroll;
            cid = id = ++uid;
            scroll_history[cid] = noscroll ? current_scroll : { x: 0, y: 0 };
        }
        yield handle_target(dest);
        if (document.activeElement && (document.activeElement instanceof HTMLElement))
            document.activeElement.blur();
        if (!noscroll) {
            let scroll = scroll_history[id];
            let deep_linked;
            if (hash) {
                // scroll is an element id (from a hash), we need to compute y.
                deep_linked = document.getElementById(hash.slice(1));
                if (deep_linked) {
                    scroll = {
                        x: 0,
                        y: deep_linked.getBoundingClientRect().top + scrollY
                    };
                }
            }
            scroll_history[cid] = scroll;
            if (popstate || deep_linked) {
                scrollTo(scroll.x, scroll.y);
            }
            else {
                scrollTo(0, 0);
            }
        }
    });
}

function get_base_uri(window_document) {
    let baseURI = window_document.baseURI;
    if (!baseURI) {
        const baseTags = window_document.getElementsByTagName('base');
        baseURI = baseTags.length ? baseTags[0].href : window_document.URL;
    }
    return baseURI;
}

let prefetching = null;
let mousemove_timeout;
function start() {
    addEventListener('touchstart', trigger_prefetch);
    addEventListener('mousemove', handle_mousemove);
}
function prefetch(href) {
    const target = select_target(new URL(href, get_base_uri(document)));
    if (target) {
        if (!prefetching || href !== prefetching.href) {
            prefetching = { href, promise: hydrate_target(target) };
        }
        return prefetching.promise;
    }
}
function get_prefetched(target) {
    if (prefetching && prefetching.href === target.href) {
        return prefetching.promise;
    }
    else {
        return hydrate_target(target);
    }
}
function trigger_prefetch(event) {
    const a = find_anchor(event.target);
    if (a && a.rel === 'prefetch') {
        prefetch(a.href);
    }
}
function handle_mousemove(event) {
    clearTimeout(mousemove_timeout);
    mousemove_timeout = setTimeout(() => {
        trigger_prefetch(event);
    }, 20);
}

function goto(href, opts = { noscroll: false, replaceState: false }) {
    const target = select_target(new URL(href, get_base_uri(document)));
    if (target) {
        _history[opts.replaceState ? 'replaceState' : 'pushState']({ id: cid }, '', href);
        return navigate(target, null, opts.noscroll);
    }
    location.href = href;
    return new Promise(() => {
        /* never resolves */
    });
}

function page_store(value) {
    const store = writable(value);
    let ready = true;
    function notify() {
        ready = true;
        store.update(val => val);
    }
    function set(new_value) {
        ready = false;
        store.set(new_value);
    }
    function subscribe(run) {
        let old_value;
        return store.subscribe((new_value) => {
            if (old_value === undefined || (ready && new_value !== old_value)) {
                run(old_value = new_value);
            }
        });
    }
    return { notify, set, subscribe };
}

const initial_data = typeof __SAPPER__ !== 'undefined' && __SAPPER__;
let ready = false;
let root_component;
let current_token;
let root_preloaded;
let current_branch = [];
let current_query = '{}';
const stores = {
    page: page_store({}),
    preloading: writable(null),
    session: writable(initial_data && initial_data.session)
};
let $session;
let session_dirty;
stores.session.subscribe((value) => __awaiter(void 0, void 0, void 0, function* () {
    $session = value;
    if (!ready)
        return;
    session_dirty = true;
    const dest = select_target(new URL(location.href));
    const token = current_token = {};
    const { redirect, props, branch } = yield hydrate_target(dest);
    if (token !== current_token)
        return; // a secondary navigation happened while we were loading
    if (redirect) {
        yield goto(redirect.location, { replaceState: true });
    }
    else {
        yield render(branch, props, buildPageContext(props, dest.page));
    }
}));
let target;
function set_target(node) {
    target = node;
}
function start$1(opts) {
    set_target(opts.target);
    init(initial_data.baseUrl, handle_target$1);
    start();
    if (initial_data.error) {
        return Promise.resolve().then(() => {
            return handle_error();
        });
    }
    return load_current_page();
}
function handle_error() {
    const { host, pathname, search } = location;
    const { session, preloaded, status, error } = initial_data;
    if (!root_preloaded) {
        root_preloaded = preloaded && preloaded[0];
    }
    const props = {
        error,
        status,
        session,
        level0: {
            props: root_preloaded
        },
        level1: {
            props: {
                status,
                error
            },
            component: Error$1
        },
        segments: preloaded
    };
    const query = extract_query(search);
    render([], props, { host, path: pathname, query, params: {}, error });
}
function buildPageContext(props, page) {
    const { error } = props;
    return Object.assign({ error }, page);
}
function handle_target$1(dest) {
    return __awaiter(this, void 0, void 0, function* () {
        if (root_component)
            stores.preloading.set(true);
        const hydrating = get_prefetched(dest);
        const token = current_token = {};
        const hydrated_target = yield hydrating;
        const { redirect } = hydrated_target;
        if (token !== current_token)
            return; // a secondary navigation happened while we were loading
        if (redirect) {
            yield goto(redirect.location, { replaceState: true });
        }
        else {
            const { props, branch } = hydrated_target;
            yield render(branch, props, buildPageContext(props, dest.page));
        }
    });
}
function render(branch, props, page) {
    return __awaiter(this, void 0, void 0, function* () {
        stores.page.set(page);
        stores.preloading.set(false);
        if (root_component) {
            root_component.$set(props);
        }
        else {
            props.stores = {
                page: { subscribe: stores.page.subscribe },
                preloading: { subscribe: stores.preloading.subscribe },
                session: stores.session
            };
            props.level0 = {
                props: yield root_preloaded
            };
            props.notify = stores.page.notify;
            root_component = new App({
                target,
                props,
                hydrate: true
            });
        }
        current_branch = branch;
        current_query = JSON.stringify(page.query);
        ready = true;
        session_dirty = false;
    });
}
function part_changed(i, segment, match, stringified_query) {
    // TODO only check query string changes for preload functions
    // that do in fact depend on it (using static analysis or
    // runtime instrumentation)
    if (stringified_query !== current_query)
        return true;
    const previous = current_branch[i];
    if (!previous)
        return false;
    if (segment !== previous.segment)
        return true;
    if (previous.match) {
        if (JSON.stringify(previous.match.slice(1, i + 2)) !== JSON.stringify(match.slice(1, i + 2))) {
            return true;
        }
    }
}
function hydrate_target(dest) {
    return __awaiter(this, void 0, void 0, function* () {
        const { route, page } = dest;
        const segments = page.path.split('/').filter(Boolean);
        let redirect = null;
        const props = { error: null, status: 200, segments: [segments[0]] };
        const preload_context = {
            fetch: (url, opts) => fetch(url, opts),
            redirect: (statusCode, location) => {
                if (redirect && (redirect.statusCode !== statusCode || redirect.location !== location)) {
                    throw new Error('Conflicting redirects');
                }
                redirect = { statusCode, location };
            },
            error: (status, error) => {
                props.error = typeof error === 'string' ? new Error(error) : error;
                props.status = status;
            }
        };
        if (!root_preloaded) {
            const root_preload = undefined || (() => ({}));
            root_preloaded = initial_data.preloaded[0] || root_preload.call(preload_context, {
                host: page.host,
                path: page.path,
                query: page.query,
                params: {}
            }, $session);
        }
        let branch;
        let l = 1;
        try {
            const stringified_query = JSON.stringify(page.query);
            const match = route.pattern.exec(page.path);
            let segment_dirty = false;
            branch = yield Promise.all(route.parts.map((part, i) => __awaiter(this, void 0, void 0, function* () {
                const segment = segments[i];
                if (part_changed(i, segment, match, stringified_query))
                    segment_dirty = true;
                props.segments[l] = segments[i + 1]; // TODO make this less confusing
                if (!part)
                    return { segment };
                const j = l++;
                if (!session_dirty && !segment_dirty && current_branch[i] && current_branch[i].part === part.i) {
                    return current_branch[i];
                }
                segment_dirty = false;
                const { default: component, preload } = yield components[part.i].js();
                let preloaded;
                if (ready || !initial_data.preloaded[i + 1]) {
                    preloaded = preload
                        ? yield preload.call(preload_context, {
                            host: page.host,
                            path: page.path,
                            query: page.query,
                            params: part.params ? part.params(dest.match) : {}
                        }, $session)
                        : {};
                }
                else {
                    preloaded = initial_data.preloaded[i + 1];
                }
                return (props[`level${j}`] = { component, props: preloaded, segment, match, part: part.i });
            })));
        }
        catch (error) {
            props.error = error;
            props.status = 500;
            branch = [];
        }
        return { redirect, props, branch };
    });
}

start$1({
	target: document.querySelector('#sapper')
});

export { SvelteComponentDev as S, space as a, detach_dev as b, claim_space as c, dispatch_dev as d, element as e, claim_element as f, children as g, claim_text as h, init$1 as i, attr_dev as j, add_location as k, src_url_equal as l, insert_hydration_dev as m, append_hydration_dev as n, noop as o, validate_each_argument as p, query_selector_all as q, set_data_dev as r, safe_not_equal as s, text as t, destroy_each as u, validate_slots as v };

import __inject_styles from './inject_styles.5607aec6.js';//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpZW50LmMwYzA2Y2ZkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9ub2RlX21vZHVsZXMvc3ZlbHRlL2ludGVybmFsL2luZGV4Lm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9zdmVsdGUvc3RvcmUvaW5kZXgubWpzIiwiLi4vLi4vLi4vc3JjL25vZGVfbW9kdWxlcy9Ac2FwcGVyL2ludGVybmFsL3NoYXJlZC5tanMiLCIuLi8uLi8uLi9zcmMvY29tcG9uZW50cy9OYXYuc3ZlbHRlIiwiLi4vLi4vLi4vc3JjL3JvdXRlcy9fbGF5b3V0LnN2ZWx0ZSIsIi4uLy4uLy4uL3NyYy9yb3V0ZXMvX2Vycm9yLnN2ZWx0ZSIsIi4uLy4uLy4uL3NyYy9ub2RlX21vZHVsZXMvQHNhcHBlci9pbnRlcm5hbC9BcHAuc3ZlbHRlIiwiLi4vLi4vLi4vc3JjL25vZGVfbW9kdWxlcy9Ac2FwcGVyL2ludGVybmFsL21hbmlmZXN0LWNsaWVudC5tanMiLCIuLi8uLi8uLi9zcmMvbm9kZV9tb2R1bGVzL0BzYXBwZXIvYXBwLm1qcyIsIi4uLy4uLy4uL3NyYy9jbGllbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZnVuY3Rpb24gbm9vcCgpIHsgfVxuY29uc3QgaWRlbnRpdHkgPSB4ID0+IHg7XG5mdW5jdGlvbiBhc3NpZ24odGFyLCBzcmMpIHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgZm9yIChjb25zdCBrIGluIHNyYylcbiAgICAgICAgdGFyW2tdID0gc3JjW2tdO1xuICAgIHJldHVybiB0YXI7XG59XG5mdW5jdGlvbiBpc19wcm9taXNlKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIHZhbHVlLnRoZW4gPT09ICdmdW5jdGlvbic7XG59XG5mdW5jdGlvbiBhZGRfbG9jYXRpb24oZWxlbWVudCwgZmlsZSwgbGluZSwgY29sdW1uLCBjaGFyKSB7XG4gICAgZWxlbWVudC5fX3N2ZWx0ZV9tZXRhID0ge1xuICAgICAgICBsb2M6IHsgZmlsZSwgbGluZSwgY29sdW1uLCBjaGFyIH1cbiAgICB9O1xufVxuZnVuY3Rpb24gcnVuKGZuKSB7XG4gICAgcmV0dXJuIGZuKCk7XG59XG5mdW5jdGlvbiBibGFua19vYmplY3QoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5jcmVhdGUobnVsbCk7XG59XG5mdW5jdGlvbiBydW5fYWxsKGZucykge1xuICAgIGZucy5mb3JFYWNoKHJ1bik7XG59XG5mdW5jdGlvbiBpc19mdW5jdGlvbih0aGluZykge1xuICAgIHJldHVybiB0eXBlb2YgdGhpbmcgPT09ICdmdW5jdGlvbic7XG59XG5mdW5jdGlvbiBzYWZlX25vdF9lcXVhbChhLCBiKSB7XG4gICAgcmV0dXJuIGEgIT0gYSA/IGIgPT0gYiA6IGEgIT09IGIgfHwgKChhICYmIHR5cGVvZiBhID09PSAnb2JqZWN0JykgfHwgdHlwZW9mIGEgPT09ICdmdW5jdGlvbicpO1xufVxubGV0IHNyY191cmxfZXF1YWxfYW5jaG9yO1xuZnVuY3Rpb24gc3JjX3VybF9lcXVhbChlbGVtZW50X3NyYywgdXJsKSB7XG4gICAgaWYgKCFzcmNfdXJsX2VxdWFsX2FuY2hvcikge1xuICAgICAgICBzcmNfdXJsX2VxdWFsX2FuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICB9XG4gICAgc3JjX3VybF9lcXVhbF9hbmNob3IuaHJlZiA9IHVybDtcbiAgICByZXR1cm4gZWxlbWVudF9zcmMgPT09IHNyY191cmxfZXF1YWxfYW5jaG9yLmhyZWY7XG59XG5mdW5jdGlvbiBub3RfZXF1YWwoYSwgYikge1xuICAgIHJldHVybiBhICE9IGEgPyBiID09IGIgOiBhICE9PSBiO1xufVxuZnVuY3Rpb24gaXNfZW1wdHkob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaikubGVuZ3RoID09PSAwO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVfc3RvcmUoc3RvcmUsIG5hbWUpIHtcbiAgICBpZiAoc3RvcmUgIT0gbnVsbCAmJiB0eXBlb2Ygc3RvcmUuc3Vic2NyaWJlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJyR7bmFtZX0nIGlzIG5vdCBhIHN0b3JlIHdpdGggYSAnc3Vic2NyaWJlJyBtZXRob2RgKTtcbiAgICB9XG59XG5mdW5jdGlvbiBzdWJzY3JpYmUoc3RvcmUsIC4uLmNhbGxiYWNrcykge1xuICAgIGlmIChzdG9yZSA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBub29wO1xuICAgIH1cbiAgICBjb25zdCB1bnN1YiA9IHN0b3JlLnN1YnNjcmliZSguLi5jYWxsYmFja3MpO1xuICAgIHJldHVybiB1bnN1Yi51bnN1YnNjcmliZSA/ICgpID0+IHVuc3ViLnVuc3Vic2NyaWJlKCkgOiB1bnN1Yjtcbn1cbmZ1bmN0aW9uIGdldF9zdG9yZV92YWx1ZShzdG9yZSkge1xuICAgIGxldCB2YWx1ZTtcbiAgICBzdWJzY3JpYmUoc3RvcmUsIF8gPT4gdmFsdWUgPSBfKSgpO1xuICAgIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIGNvbXBvbmVudF9zdWJzY3JpYmUoY29tcG9uZW50LCBzdG9yZSwgY2FsbGJhY2spIHtcbiAgICBjb21wb25lbnQuJCQub25fZGVzdHJveS5wdXNoKHN1YnNjcmliZShzdG9yZSwgY2FsbGJhY2spKTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZV9zbG90KGRlZmluaXRpb24sIGN0eCwgJCRzY29wZSwgZm4pIHtcbiAgICBpZiAoZGVmaW5pdGlvbikge1xuICAgICAgICBjb25zdCBzbG90X2N0eCA9IGdldF9zbG90X2NvbnRleHQoZGVmaW5pdGlvbiwgY3R4LCAkJHNjb3BlLCBmbik7XG4gICAgICAgIHJldHVybiBkZWZpbml0aW9uWzBdKHNsb3RfY3R4KTtcbiAgICB9XG59XG5mdW5jdGlvbiBnZXRfc2xvdF9jb250ZXh0KGRlZmluaXRpb24sIGN0eCwgJCRzY29wZSwgZm4pIHtcbiAgICByZXR1cm4gZGVmaW5pdGlvblsxXSAmJiBmblxuICAgICAgICA/IGFzc2lnbigkJHNjb3BlLmN0eC5zbGljZSgpLCBkZWZpbml0aW9uWzFdKGZuKGN0eCkpKVxuICAgICAgICA6ICQkc2NvcGUuY3R4O1xufVxuZnVuY3Rpb24gZ2V0X3Nsb3RfY2hhbmdlcyhkZWZpbml0aW9uLCAkJHNjb3BlLCBkaXJ0eSwgZm4pIHtcbiAgICBpZiAoZGVmaW5pdGlvblsyXSAmJiBmbikge1xuICAgICAgICBjb25zdCBsZXRzID0gZGVmaW5pdGlvblsyXShmbihkaXJ0eSkpO1xuICAgICAgICBpZiAoJCRzY29wZS5kaXJ0eSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gbGV0cztcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGxldHMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBjb25zdCBtZXJnZWQgPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IE1hdGgubWF4KCQkc2NvcGUuZGlydHkubGVuZ3RoLCBsZXRzLmxlbmd0aCk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgbWVyZ2VkW2ldID0gJCRzY29wZS5kaXJ0eVtpXSB8IGxldHNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWVyZ2VkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAkJHNjb3BlLmRpcnR5IHwgbGV0cztcbiAgICB9XG4gICAgcmV0dXJuICQkc2NvcGUuZGlydHk7XG59XG5mdW5jdGlvbiB1cGRhdGVfc2xvdF9iYXNlKHNsb3QsIHNsb3RfZGVmaW5pdGlvbiwgY3R4LCAkJHNjb3BlLCBzbG90X2NoYW5nZXMsIGdldF9zbG90X2NvbnRleHRfZm4pIHtcbiAgICBpZiAoc2xvdF9jaGFuZ2VzKSB7XG4gICAgICAgIGNvbnN0IHNsb3RfY29udGV4dCA9IGdldF9zbG90X2NvbnRleHQoc2xvdF9kZWZpbml0aW9uLCBjdHgsICQkc2NvcGUsIGdldF9zbG90X2NvbnRleHRfZm4pO1xuICAgICAgICBzbG90LnAoc2xvdF9jb250ZXh0LCBzbG90X2NoYW5nZXMpO1xuICAgIH1cbn1cbmZ1bmN0aW9uIHVwZGF0ZV9zbG90KHNsb3QsIHNsb3RfZGVmaW5pdGlvbiwgY3R4LCAkJHNjb3BlLCBkaXJ0eSwgZ2V0X3Nsb3RfY2hhbmdlc19mbiwgZ2V0X3Nsb3RfY29udGV4dF9mbikge1xuICAgIGNvbnN0IHNsb3RfY2hhbmdlcyA9IGdldF9zbG90X2NoYW5nZXMoc2xvdF9kZWZpbml0aW9uLCAkJHNjb3BlLCBkaXJ0eSwgZ2V0X3Nsb3RfY2hhbmdlc19mbik7XG4gICAgdXBkYXRlX3Nsb3RfYmFzZShzbG90LCBzbG90X2RlZmluaXRpb24sIGN0eCwgJCRzY29wZSwgc2xvdF9jaGFuZ2VzLCBnZXRfc2xvdF9jb250ZXh0X2ZuKTtcbn1cbmZ1bmN0aW9uIGdldF9hbGxfZGlydHlfZnJvbV9zY29wZSgkJHNjb3BlKSB7XG4gICAgaWYgKCQkc2NvcGUuY3R4Lmxlbmd0aCA+IDMyKSB7XG4gICAgICAgIGNvbnN0IGRpcnR5ID0gW107XG4gICAgICAgIGNvbnN0IGxlbmd0aCA9ICQkc2NvcGUuY3R4Lmxlbmd0aCAvIDMyO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBkaXJ0eVtpXSA9IC0xO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkaXJ0eTtcbiAgICB9XG4gICAgcmV0dXJuIC0xO1xufVxuZnVuY3Rpb24gZXhjbHVkZV9pbnRlcm5hbF9wcm9wcyhwcm9wcykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgIGZvciAoY29uc3QgayBpbiBwcm9wcylcbiAgICAgICAgaWYgKGtbMF0gIT09ICckJylcbiAgICAgICAgICAgIHJlc3VsdFtrXSA9IHByb3BzW2tdO1xuICAgIHJldHVybiByZXN1bHQ7XG59XG5mdW5jdGlvbiBjb21wdXRlX3Jlc3RfcHJvcHMocHJvcHMsIGtleXMpIHtcbiAgICBjb25zdCByZXN0ID0ge307XG4gICAga2V5cyA9IG5ldyBTZXQoa2V5cyk7XG4gICAgZm9yIChjb25zdCBrIGluIHByb3BzKVxuICAgICAgICBpZiAoIWtleXMuaGFzKGspICYmIGtbMF0gIT09ICckJylcbiAgICAgICAgICAgIHJlc3Rba10gPSBwcm9wc1trXTtcbiAgICByZXR1cm4gcmVzdDtcbn1cbmZ1bmN0aW9uIGNvbXB1dGVfc2xvdHMoc2xvdHMpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGtleSBpbiBzbG90cykge1xuICAgICAgICByZXN1bHRba2V5XSA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5mdW5jdGlvbiBvbmNlKGZuKSB7XG4gICAgbGV0IHJhbiA9IGZhbHNlO1xuICAgIHJldHVybiBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgICBpZiAocmFuKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICByYW4gPSB0cnVlO1xuICAgICAgICBmbi5jYWxsKHRoaXMsIC4uLmFyZ3MpO1xuICAgIH07XG59XG5mdW5jdGlvbiBudWxsX3RvX2VtcHR5KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlO1xufVxuZnVuY3Rpb24gc2V0X3N0b3JlX3ZhbHVlKHN0b3JlLCByZXQsIHZhbHVlKSB7XG4gICAgc3RvcmUuc2V0KHZhbHVlKTtcbiAgICByZXR1cm4gcmV0O1xufVxuY29uc3QgaGFzX3Byb3AgPSAob2JqLCBwcm9wKSA9PiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbmZ1bmN0aW9uIGFjdGlvbl9kZXN0cm95ZXIoYWN0aW9uX3Jlc3VsdCkge1xuICAgIHJldHVybiBhY3Rpb25fcmVzdWx0ICYmIGlzX2Z1bmN0aW9uKGFjdGlvbl9yZXN1bHQuZGVzdHJveSkgPyBhY3Rpb25fcmVzdWx0LmRlc3Ryb3kgOiBub29wO1xufVxuXG5jb25zdCBpc19jbGllbnQgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJztcbmxldCBub3cgPSBpc19jbGllbnRcbiAgICA/ICgpID0+IHdpbmRvdy5wZXJmb3JtYW5jZS5ub3coKVxuICAgIDogKCkgPT4gRGF0ZS5ub3coKTtcbmxldCByYWYgPSBpc19jbGllbnQgPyBjYiA9PiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2IpIDogbm9vcDtcbi8vIHVzZWQgaW50ZXJuYWxseSBmb3IgdGVzdGluZ1xuZnVuY3Rpb24gc2V0X25vdyhmbikge1xuICAgIG5vdyA9IGZuO1xufVxuZnVuY3Rpb24gc2V0X3JhZihmbikge1xuICAgIHJhZiA9IGZuO1xufVxuXG5jb25zdCB0YXNrcyA9IG5ldyBTZXQoKTtcbmZ1bmN0aW9uIHJ1bl90YXNrcyhub3cpIHtcbiAgICB0YXNrcy5mb3JFYWNoKHRhc2sgPT4ge1xuICAgICAgICBpZiAoIXRhc2suYyhub3cpKSB7XG4gICAgICAgICAgICB0YXNrcy5kZWxldGUodGFzayk7XG4gICAgICAgICAgICB0YXNrLmYoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIGlmICh0YXNrcy5zaXplICE9PSAwKVxuICAgICAgICByYWYocnVuX3Rhc2tzKTtcbn1cbi8qKlxuICogRm9yIHRlc3RpbmcgcHVycG9zZXMgb25seSFcbiAqL1xuZnVuY3Rpb24gY2xlYXJfbG9vcHMoKSB7XG4gICAgdGFza3MuY2xlYXIoKTtcbn1cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyB0YXNrIHRoYXQgcnVucyBvbiBlYWNoIHJhZiBmcmFtZVxuICogdW50aWwgaXQgcmV0dXJucyBhIGZhbHN5IHZhbHVlIG9yIGlzIGFib3J0ZWRcbiAqL1xuZnVuY3Rpb24gbG9vcChjYWxsYmFjaykge1xuICAgIGxldCB0YXNrO1xuICAgIGlmICh0YXNrcy5zaXplID09PSAwKVxuICAgICAgICByYWYocnVuX3Rhc2tzKTtcbiAgICByZXR1cm4ge1xuICAgICAgICBwcm9taXNlOiBuZXcgUHJvbWlzZShmdWxmaWxsID0+IHtcbiAgICAgICAgICAgIHRhc2tzLmFkZCh0YXNrID0geyBjOiBjYWxsYmFjaywgZjogZnVsZmlsbCB9KTtcbiAgICAgICAgfSksXG4gICAgICAgIGFib3J0KCkge1xuICAgICAgICAgICAgdGFza3MuZGVsZXRlKHRhc2spO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuLy8gVHJhY2sgd2hpY2ggbm9kZXMgYXJlIGNsYWltZWQgZHVyaW5nIGh5ZHJhdGlvbi4gVW5jbGFpbWVkIG5vZGVzIGNhbiB0aGVuIGJlIHJlbW92ZWQgZnJvbSB0aGUgRE9NXG4vLyBhdCB0aGUgZW5kIG9mIGh5ZHJhdGlvbiB3aXRob3V0IHRvdWNoaW5nIHRoZSByZW1haW5pbmcgbm9kZXMuXG5sZXQgaXNfaHlkcmF0aW5nID0gZmFsc2U7XG5mdW5jdGlvbiBzdGFydF9oeWRyYXRpbmcoKSB7XG4gICAgaXNfaHlkcmF0aW5nID0gdHJ1ZTtcbn1cbmZ1bmN0aW9uIGVuZF9oeWRyYXRpbmcoKSB7XG4gICAgaXNfaHlkcmF0aW5nID0gZmFsc2U7XG59XG5mdW5jdGlvbiB1cHBlcl9ib3VuZChsb3csIGhpZ2gsIGtleSwgdmFsdWUpIHtcbiAgICAvLyBSZXR1cm4gZmlyc3QgaW5kZXggb2YgdmFsdWUgbGFyZ2VyIHRoYW4gaW5wdXQgdmFsdWUgaW4gdGhlIHJhbmdlIFtsb3csIGhpZ2gpXG4gICAgd2hpbGUgKGxvdyA8IGhpZ2gpIHtcbiAgICAgICAgY29uc3QgbWlkID0gbG93ICsgKChoaWdoIC0gbG93KSA+PiAxKTtcbiAgICAgICAgaWYgKGtleShtaWQpIDw9IHZhbHVlKSB7XG4gICAgICAgICAgICBsb3cgPSBtaWQgKyAxO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaGlnaCA9IG1pZDtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbG93O1xufVxuZnVuY3Rpb24gaW5pdF9oeWRyYXRlKHRhcmdldCkge1xuICAgIGlmICh0YXJnZXQuaHlkcmF0ZV9pbml0KVxuICAgICAgICByZXR1cm47XG4gICAgdGFyZ2V0Lmh5ZHJhdGVfaW5pdCA9IHRydWU7XG4gICAgLy8gV2Uga25vdyB0aGF0IGFsbCBjaGlsZHJlbiBoYXZlIGNsYWltX29yZGVyIHZhbHVlcyBzaW5jZSB0aGUgdW5jbGFpbWVkIGhhdmUgYmVlbiBkZXRhY2hlZCBpZiB0YXJnZXQgaXMgbm90IDxoZWFkPlxuICAgIGxldCBjaGlsZHJlbiA9IHRhcmdldC5jaGlsZE5vZGVzO1xuICAgIC8vIElmIHRhcmdldCBpcyA8aGVhZD4sIHRoZXJlIG1heSBiZSBjaGlsZHJlbiB3aXRob3V0IGNsYWltX29yZGVyXG4gICAgaWYgKHRhcmdldC5ub2RlTmFtZSA9PT0gJ0hFQUQnKSB7XG4gICAgICAgIGNvbnN0IG15Q2hpbGRyZW4gPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgaWYgKG5vZGUuY2xhaW1fb3JkZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIG15Q2hpbGRyZW4ucHVzaChub2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjaGlsZHJlbiA9IG15Q2hpbGRyZW47XG4gICAgfVxuICAgIC8qXG4gICAgKiBSZW9yZGVyIGNsYWltZWQgY2hpbGRyZW4gb3B0aW1hbGx5LlxuICAgICogV2UgY2FuIHJlb3JkZXIgY2xhaW1lZCBjaGlsZHJlbiBvcHRpbWFsbHkgYnkgZmluZGluZyB0aGUgbG9uZ2VzdCBzdWJzZXF1ZW5jZSBvZlxuICAgICogbm9kZXMgdGhhdCBhcmUgYWxyZWFkeSBjbGFpbWVkIGluIG9yZGVyIGFuZCBvbmx5IG1vdmluZyB0aGUgcmVzdC4gVGhlIGxvbmdlc3RcbiAgICAqIHN1YnNlcXVlbmNlIHN1YnNlcXVlbmNlIG9mIG5vZGVzIHRoYXQgYXJlIGNsYWltZWQgaW4gb3JkZXIgY2FuIGJlIGZvdW5kIGJ5XG4gICAgKiBjb21wdXRpbmcgdGhlIGxvbmdlc3QgaW5jcmVhc2luZyBzdWJzZXF1ZW5jZSBvZiAuY2xhaW1fb3JkZXIgdmFsdWVzLlxuICAgICpcbiAgICAqIFRoaXMgYWxnb3JpdGhtIGlzIG9wdGltYWwgaW4gZ2VuZXJhdGluZyB0aGUgbGVhc3QgYW1vdW50IG9mIHJlb3JkZXIgb3BlcmF0aW9uc1xuICAgICogcG9zc2libGUuXG4gICAgKlxuICAgICogUHJvb2Y6XG4gICAgKiBXZSBrbm93IHRoYXQsIGdpdmVuIGEgc2V0IG9mIHJlb3JkZXJpbmcgb3BlcmF0aW9ucywgdGhlIG5vZGVzIHRoYXQgZG8gbm90IG1vdmVcbiAgICAqIGFsd2F5cyBmb3JtIGFuIGluY3JlYXNpbmcgc3Vic2VxdWVuY2UsIHNpbmNlIHRoZXkgZG8gbm90IG1vdmUgYW1vbmcgZWFjaCBvdGhlclxuICAgICogbWVhbmluZyB0aGF0IHRoZXkgbXVzdCBiZSBhbHJlYWR5IG9yZGVyZWQgYW1vbmcgZWFjaCBvdGhlci4gVGh1cywgdGhlIG1heGltYWxcbiAgICAqIHNldCBvZiBub2RlcyB0aGF0IGRvIG5vdCBtb3ZlIGZvcm0gYSBsb25nZXN0IGluY3JlYXNpbmcgc3Vic2VxdWVuY2UuXG4gICAgKi9cbiAgICAvLyBDb21wdXRlIGxvbmdlc3QgaW5jcmVhc2luZyBzdWJzZXF1ZW5jZVxuICAgIC8vIG06IHN1YnNlcXVlbmNlIGxlbmd0aCBqID0+IGluZGV4IGsgb2Ygc21hbGxlc3QgdmFsdWUgdGhhdCBlbmRzIGFuIGluY3JlYXNpbmcgc3Vic2VxdWVuY2Ugb2YgbGVuZ3RoIGpcbiAgICBjb25zdCBtID0gbmV3IEludDMyQXJyYXkoY2hpbGRyZW4ubGVuZ3RoICsgMSk7XG4gICAgLy8gUHJlZGVjZXNzb3IgaW5kaWNlcyArIDFcbiAgICBjb25zdCBwID0gbmV3IEludDMyQXJyYXkoY2hpbGRyZW4ubGVuZ3RoKTtcbiAgICBtWzBdID0gLTE7XG4gICAgbGV0IGxvbmdlc3QgPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IGNoaWxkcmVuW2ldLmNsYWltX29yZGVyO1xuICAgICAgICAvLyBGaW5kIHRoZSBsYXJnZXN0IHN1YnNlcXVlbmNlIGxlbmd0aCBzdWNoIHRoYXQgaXQgZW5kcyBpbiBhIHZhbHVlIGxlc3MgdGhhbiBvdXIgY3VycmVudCB2YWx1ZVxuICAgICAgICAvLyB1cHBlcl9ib3VuZCByZXR1cm5zIGZpcnN0IGdyZWF0ZXIgdmFsdWUsIHNvIHdlIHN1YnRyYWN0IG9uZVxuICAgICAgICAvLyB3aXRoIGZhc3QgcGF0aCBmb3Igd2hlbiB3ZSBhcmUgb24gdGhlIGN1cnJlbnQgbG9uZ2VzdCBzdWJzZXF1ZW5jZVxuICAgICAgICBjb25zdCBzZXFMZW4gPSAoKGxvbmdlc3QgPiAwICYmIGNoaWxkcmVuW21bbG9uZ2VzdF1dLmNsYWltX29yZGVyIDw9IGN1cnJlbnQpID8gbG9uZ2VzdCArIDEgOiB1cHBlcl9ib3VuZCgxLCBsb25nZXN0LCBpZHggPT4gY2hpbGRyZW5bbVtpZHhdXS5jbGFpbV9vcmRlciwgY3VycmVudCkpIC0gMTtcbiAgICAgICAgcFtpXSA9IG1bc2VxTGVuXSArIDE7XG4gICAgICAgIGNvbnN0IG5ld0xlbiA9IHNlcUxlbiArIDE7XG4gICAgICAgIC8vIFdlIGNhbiBndWFyYW50ZWUgdGhhdCBjdXJyZW50IGlzIHRoZSBzbWFsbGVzdCB2YWx1ZS4gT3RoZXJ3aXNlLCB3ZSB3b3VsZCBoYXZlIGdlbmVyYXRlZCBhIGxvbmdlciBzZXF1ZW5jZS5cbiAgICAgICAgbVtuZXdMZW5dID0gaTtcbiAgICAgICAgbG9uZ2VzdCA9IE1hdGgubWF4KG5ld0xlbiwgbG9uZ2VzdCk7XG4gICAgfVxuICAgIC8vIFRoZSBsb25nZXN0IGluY3JlYXNpbmcgc3Vic2VxdWVuY2Ugb2Ygbm9kZXMgKGluaXRpYWxseSByZXZlcnNlZClcbiAgICBjb25zdCBsaXMgPSBbXTtcbiAgICAvLyBUaGUgcmVzdCBvZiB0aGUgbm9kZXMsIG5vZGVzIHRoYXQgd2lsbCBiZSBtb3ZlZFxuICAgIGNvbnN0IHRvTW92ZSA9IFtdO1xuICAgIGxldCBsYXN0ID0gY2hpbGRyZW4ubGVuZ3RoIC0gMTtcbiAgICBmb3IgKGxldCBjdXIgPSBtW2xvbmdlc3RdICsgMTsgY3VyICE9IDA7IGN1ciA9IHBbY3VyIC0gMV0pIHtcbiAgICAgICAgbGlzLnB1c2goY2hpbGRyZW5bY3VyIC0gMV0pO1xuICAgICAgICBmb3IgKDsgbGFzdCA+PSBjdXI7IGxhc3QtLSkge1xuICAgICAgICAgICAgdG9Nb3ZlLnB1c2goY2hpbGRyZW5bbGFzdF0pO1xuICAgICAgICB9XG4gICAgICAgIGxhc3QtLTtcbiAgICB9XG4gICAgZm9yICg7IGxhc3QgPj0gMDsgbGFzdC0tKSB7XG4gICAgICAgIHRvTW92ZS5wdXNoKGNoaWxkcmVuW2xhc3RdKTtcbiAgICB9XG4gICAgbGlzLnJldmVyc2UoKTtcbiAgICAvLyBXZSBzb3J0IHRoZSBub2RlcyBiZWluZyBtb3ZlZCB0byBndWFyYW50ZWUgdGhhdCB0aGVpciBpbnNlcnRpb24gb3JkZXIgbWF0Y2hlcyB0aGUgY2xhaW0gb3JkZXJcbiAgICB0b01vdmUuc29ydCgoYSwgYikgPT4gYS5jbGFpbV9vcmRlciAtIGIuY2xhaW1fb3JkZXIpO1xuICAgIC8vIEZpbmFsbHksIHdlIG1vdmUgdGhlIG5vZGVzXG4gICAgZm9yIChsZXQgaSA9IDAsIGogPSAwOyBpIDwgdG9Nb3ZlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHdoaWxlIChqIDwgbGlzLmxlbmd0aCAmJiB0b01vdmVbaV0uY2xhaW1fb3JkZXIgPj0gbGlzW2pdLmNsYWltX29yZGVyKSB7XG4gICAgICAgICAgICBqKys7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYW5jaG9yID0gaiA8IGxpcy5sZW5ndGggPyBsaXNbal0gOiBudWxsO1xuICAgICAgICB0YXJnZXQuaW5zZXJ0QmVmb3JlKHRvTW92ZVtpXSwgYW5jaG9yKTtcbiAgICB9XG59XG5mdW5jdGlvbiBhcHBlbmQodGFyZ2V0LCBub2RlKSB7XG4gICAgdGFyZ2V0LmFwcGVuZENoaWxkKG5vZGUpO1xufVxuZnVuY3Rpb24gYXBwZW5kX3N0eWxlcyh0YXJnZXQsIHN0eWxlX3NoZWV0X2lkLCBzdHlsZXMpIHtcbiAgICBjb25zdCBhcHBlbmRfc3R5bGVzX3RvID0gZ2V0X3Jvb3RfZm9yX3N0eWxlKHRhcmdldCk7XG4gICAgaWYgKCFhcHBlbmRfc3R5bGVzX3RvLmdldEVsZW1lbnRCeUlkKHN0eWxlX3NoZWV0X2lkKSkge1xuICAgICAgICBjb25zdCBzdHlsZSA9IGVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgICAgIHN0eWxlLmlkID0gc3R5bGVfc2hlZXRfaWQ7XG4gICAgICAgIHN0eWxlLnRleHRDb250ZW50ID0gc3R5bGVzO1xuICAgICAgICBhcHBlbmRfc3R5bGVzaGVldChhcHBlbmRfc3R5bGVzX3RvLCBzdHlsZSk7XG4gICAgfVxufVxuZnVuY3Rpb24gZ2V0X3Jvb3RfZm9yX3N0eWxlKG5vZGUpIHtcbiAgICBpZiAoIW5vZGUpXG4gICAgICAgIHJldHVybiBkb2N1bWVudDtcbiAgICBjb25zdCByb290ID0gbm9kZS5nZXRSb290Tm9kZSA/IG5vZGUuZ2V0Um9vdE5vZGUoKSA6IG5vZGUub3duZXJEb2N1bWVudDtcbiAgICBpZiAocm9vdCAmJiByb290Lmhvc3QpIHtcbiAgICAgICAgcmV0dXJuIHJvb3Q7XG4gICAgfVxuICAgIHJldHVybiBub2RlLm93bmVyRG9jdW1lbnQ7XG59XG5mdW5jdGlvbiBhcHBlbmRfZW1wdHlfc3R5bGVzaGVldChub2RlKSB7XG4gICAgY29uc3Qgc3R5bGVfZWxlbWVudCA9IGVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgYXBwZW5kX3N0eWxlc2hlZXQoZ2V0X3Jvb3RfZm9yX3N0eWxlKG5vZGUpLCBzdHlsZV9lbGVtZW50KTtcbiAgICByZXR1cm4gc3R5bGVfZWxlbWVudDtcbn1cbmZ1bmN0aW9uIGFwcGVuZF9zdHlsZXNoZWV0KG5vZGUsIHN0eWxlKSB7XG4gICAgYXBwZW5kKG5vZGUuaGVhZCB8fCBub2RlLCBzdHlsZSk7XG59XG5mdW5jdGlvbiBhcHBlbmRfaHlkcmF0aW9uKHRhcmdldCwgbm9kZSkge1xuICAgIGlmIChpc19oeWRyYXRpbmcpIHtcbiAgICAgICAgaW5pdF9oeWRyYXRlKHRhcmdldCk7XG4gICAgICAgIGlmICgodGFyZ2V0LmFjdHVhbF9lbmRfY2hpbGQgPT09IHVuZGVmaW5lZCkgfHwgKCh0YXJnZXQuYWN0dWFsX2VuZF9jaGlsZCAhPT0gbnVsbCkgJiYgKHRhcmdldC5hY3R1YWxfZW5kX2NoaWxkLnBhcmVudEVsZW1lbnQgIT09IHRhcmdldCkpKSB7XG4gICAgICAgICAgICB0YXJnZXQuYWN0dWFsX2VuZF9jaGlsZCA9IHRhcmdldC5maXJzdENoaWxkO1xuICAgICAgICB9XG4gICAgICAgIC8vIFNraXAgbm9kZXMgb2YgdW5kZWZpbmVkIG9yZGVyaW5nXG4gICAgICAgIHdoaWxlICgodGFyZ2V0LmFjdHVhbF9lbmRfY2hpbGQgIT09IG51bGwpICYmICh0YXJnZXQuYWN0dWFsX2VuZF9jaGlsZC5jbGFpbV9vcmRlciA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAgICAgdGFyZ2V0LmFjdHVhbF9lbmRfY2hpbGQgPSB0YXJnZXQuYWN0dWFsX2VuZF9jaGlsZC5uZXh0U2libGluZztcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZSAhPT0gdGFyZ2V0LmFjdHVhbF9lbmRfY2hpbGQpIHtcbiAgICAgICAgICAgIC8vIFdlIG9ubHkgaW5zZXJ0IGlmIHRoZSBvcmRlcmluZyBvZiB0aGlzIG5vZGUgc2hvdWxkIGJlIG1vZGlmaWVkIG9yIHRoZSBwYXJlbnQgbm9kZSBpcyBub3QgdGFyZ2V0XG4gICAgICAgICAgICBpZiAobm9kZS5jbGFpbV9vcmRlciAhPT0gdW5kZWZpbmVkIHx8IG5vZGUucGFyZW50Tm9kZSAhPT0gdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Lmluc2VydEJlZm9yZShub2RlLCB0YXJnZXQuYWN0dWFsX2VuZF9jaGlsZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0YXJnZXQuYWN0dWFsX2VuZF9jaGlsZCA9IG5vZGUubmV4dFNpYmxpbmc7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAobm9kZS5wYXJlbnROb2RlICE9PSB0YXJnZXQgfHwgbm9kZS5uZXh0U2libGluZyAhPT0gbnVsbCkge1xuICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQobm9kZSk7XG4gICAgfVxufVxuZnVuY3Rpb24gaW5zZXJ0KHRhcmdldCwgbm9kZSwgYW5jaG9yKSB7XG4gICAgdGFyZ2V0Lmluc2VydEJlZm9yZShub2RlLCBhbmNob3IgfHwgbnVsbCk7XG59XG5mdW5jdGlvbiBpbnNlcnRfaHlkcmF0aW9uKHRhcmdldCwgbm9kZSwgYW5jaG9yKSB7XG4gICAgaWYgKGlzX2h5ZHJhdGluZyAmJiAhYW5jaG9yKSB7XG4gICAgICAgIGFwcGVuZF9oeWRyYXRpb24odGFyZ2V0LCBub2RlKTtcbiAgICB9XG4gICAgZWxzZSBpZiAobm9kZS5wYXJlbnROb2RlICE9PSB0YXJnZXQgfHwgbm9kZS5uZXh0U2libGluZyAhPSBhbmNob3IpIHtcbiAgICAgICAgdGFyZ2V0Lmluc2VydEJlZm9yZShub2RlLCBhbmNob3IgfHwgbnVsbCk7XG4gICAgfVxufVxuZnVuY3Rpb24gZGV0YWNoKG5vZGUpIHtcbiAgICBub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobm9kZSk7XG59XG5mdW5jdGlvbiBkZXN0cm95X2VhY2goaXRlcmF0aW9ucywgZGV0YWNoaW5nKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVyYXRpb25zLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIGlmIChpdGVyYXRpb25zW2ldKVxuICAgICAgICAgICAgaXRlcmF0aW9uc1tpXS5kKGRldGFjaGluZyk7XG4gICAgfVxufVxuZnVuY3Rpb24gZWxlbWVudChuYW1lKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobmFtZSk7XG59XG5mdW5jdGlvbiBlbGVtZW50X2lzKG5hbWUsIGlzKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobmFtZSwgeyBpcyB9KTtcbn1cbmZ1bmN0aW9uIG9iamVjdF93aXRob3V0X3Byb3BlcnRpZXMob2JqLCBleGNsdWRlKSB7XG4gICAgY29uc3QgdGFyZ2V0ID0ge307XG4gICAgZm9yIChjb25zdCBrIGluIG9iaikge1xuICAgICAgICBpZiAoaGFzX3Byb3Aob2JqLCBrKVxuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgJiYgZXhjbHVkZS5pbmRleE9mKGspID09PSAtMSkge1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgdGFyZ2V0W2tdID0gb2JqW2tdO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5mdW5jdGlvbiBzdmdfZWxlbWVudChuYW1lKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCBuYW1lKTtcbn1cbmZ1bmN0aW9uIHRleHQoZGF0YSkge1xuICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShkYXRhKTtcbn1cbmZ1bmN0aW9uIHNwYWNlKCkge1xuICAgIHJldHVybiB0ZXh0KCcgJyk7XG59XG5mdW5jdGlvbiBlbXB0eSgpIHtcbiAgICByZXR1cm4gdGV4dCgnJyk7XG59XG5mdW5jdGlvbiBsaXN0ZW4obm9kZSwgZXZlbnQsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIsIG9wdGlvbnMpO1xuICAgIHJldHVybiAoKSA9PiBub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIsIG9wdGlvbnMpO1xufVxuZnVuY3Rpb24gcHJldmVudF9kZWZhdWx0KGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIHJldHVybiBmbi5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICB9O1xufVxuZnVuY3Rpb24gc3RvcF9wcm9wYWdhdGlvbihmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgcmV0dXJuIGZuLmNhbGwodGhpcywgZXZlbnQpO1xuICAgIH07XG59XG5mdW5jdGlvbiBzZWxmKGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGlmIChldmVudC50YXJnZXQgPT09IHRoaXMpXG4gICAgICAgICAgICBmbi5jYWxsKHRoaXMsIGV2ZW50KTtcbiAgICB9O1xufVxuZnVuY3Rpb24gdHJ1c3RlZChmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBpZiAoZXZlbnQuaXNUcnVzdGVkKVxuICAgICAgICAgICAgZm4uY2FsbCh0aGlzLCBldmVudCk7XG4gICAgfTtcbn1cbmZ1bmN0aW9uIGF0dHIobm9kZSwgYXR0cmlidXRlLCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKVxuICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyaWJ1dGUpO1xuICAgIGVsc2UgaWYgKG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJpYnV0ZSkgIT09IHZhbHVlKVxuICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShhdHRyaWJ1dGUsIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIHNldF9hdHRyaWJ1dGVzKG5vZGUsIGF0dHJpYnV0ZXMpIHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3QgZGVzY3JpcHRvcnMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyhub2RlLl9fcHJvdG9fXyk7XG4gICAgZm9yIChjb25zdCBrZXkgaW4gYXR0cmlidXRlcykge1xuICAgICAgICBpZiAoYXR0cmlidXRlc1trZXldID09IG51bGwpIHtcbiAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGtleSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoa2V5ID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgICBub2RlLnN0eWxlLmNzc1RleHQgPSBhdHRyaWJ1dGVzW2tleV07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoa2V5ID09PSAnX192YWx1ZScpIHtcbiAgICAgICAgICAgIG5vZGUudmFsdWUgPSBub2RlW2tleV0gPSBhdHRyaWJ1dGVzW2tleV07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZGVzY3JpcHRvcnNba2V5XSAmJiBkZXNjcmlwdG9yc1trZXldLnNldCkge1xuICAgICAgICAgICAgbm9kZVtrZXldID0gYXR0cmlidXRlc1trZXldO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgYXR0cihub2RlLCBrZXksIGF0dHJpYnV0ZXNba2V5XSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5mdW5jdGlvbiBzZXRfc3ZnX2F0dHJpYnV0ZXMobm9kZSwgYXR0cmlidXRlcykge1xuICAgIGZvciAoY29uc3Qga2V5IGluIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgYXR0cihub2RlLCBrZXksIGF0dHJpYnV0ZXNba2V5XSk7XG4gICAgfVxufVxuZnVuY3Rpb24gc2V0X2N1c3RvbV9lbGVtZW50X2RhdGEobm9kZSwgcHJvcCwgdmFsdWUpIHtcbiAgICBpZiAocHJvcCBpbiBub2RlKSB7XG4gICAgICAgIG5vZGVbcHJvcF0gPSB0eXBlb2Ygbm9kZVtwcm9wXSA9PT0gJ2Jvb2xlYW4nICYmIHZhbHVlID09PSAnJyA/IHRydWUgOiB2YWx1ZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGF0dHIobm9kZSwgcHJvcCwgdmFsdWUpO1xuICAgIH1cbn1cbmZ1bmN0aW9uIHhsaW5rX2F0dHIobm9kZSwgYXR0cmlidXRlLCB2YWx1ZSkge1xuICAgIG5vZGUuc2V0QXR0cmlidXRlTlMoJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnLCBhdHRyaWJ1dGUsIHZhbHVlKTtcbn1cbmZ1bmN0aW9uIGdldF9iaW5kaW5nX2dyb3VwX3ZhbHVlKGdyb3VwLCBfX3ZhbHVlLCBjaGVja2VkKSB7XG4gICAgY29uc3QgdmFsdWUgPSBuZXcgU2V0KCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBncm91cC5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBpZiAoZ3JvdXBbaV0uY2hlY2tlZClcbiAgICAgICAgICAgIHZhbHVlLmFkZChncm91cFtpXS5fX3ZhbHVlKTtcbiAgICB9XG4gICAgaWYgKCFjaGVja2VkKSB7XG4gICAgICAgIHZhbHVlLmRlbGV0ZShfX3ZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIEFycmF5LmZyb20odmFsdWUpO1xufVxuZnVuY3Rpb24gdG9fbnVtYmVyKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSAnJyA/IG51bGwgOiArdmFsdWU7XG59XG5mdW5jdGlvbiB0aW1lX3Jhbmdlc190b19hcnJheShyYW5nZXMpIHtcbiAgICBjb25zdCBhcnJheSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmFuZ2VzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIGFycmF5LnB1c2goeyBzdGFydDogcmFuZ2VzLnN0YXJ0KGkpLCBlbmQ6IHJhbmdlcy5lbmQoaSkgfSk7XG4gICAgfVxuICAgIHJldHVybiBhcnJheTtcbn1cbmZ1bmN0aW9uIGNoaWxkcmVuKGVsZW1lbnQpIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShlbGVtZW50LmNoaWxkTm9kZXMpO1xufVxuZnVuY3Rpb24gaW5pdF9jbGFpbV9pbmZvKG5vZGVzKSB7XG4gICAgaWYgKG5vZGVzLmNsYWltX2luZm8gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBub2Rlcy5jbGFpbV9pbmZvID0geyBsYXN0X2luZGV4OiAwLCB0b3RhbF9jbGFpbWVkOiAwIH07XG4gICAgfVxufVxuZnVuY3Rpb24gY2xhaW1fbm9kZShub2RlcywgcHJlZGljYXRlLCBwcm9jZXNzTm9kZSwgY3JlYXRlTm9kZSwgZG9udFVwZGF0ZUxhc3RJbmRleCA9IGZhbHNlKSB7XG4gICAgLy8gVHJ5IHRvIGZpbmQgbm9kZXMgaW4gYW4gb3JkZXIgc3VjaCB0aGF0IHdlIGxlbmd0aGVuIHRoZSBsb25nZXN0IGluY3JlYXNpbmcgc3Vic2VxdWVuY2VcbiAgICBpbml0X2NsYWltX2luZm8obm9kZXMpO1xuICAgIGNvbnN0IHJlc3VsdE5vZGUgPSAoKCkgPT4ge1xuICAgICAgICAvLyBXZSBmaXJzdCB0cnkgdG8gZmluZCBhbiBlbGVtZW50IGFmdGVyIHRoZSBwcmV2aW91cyBvbmVcbiAgICAgICAgZm9yIChsZXQgaSA9IG5vZGVzLmNsYWltX2luZm8ubGFzdF9pbmRleDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gbm9kZXNbaV07XG4gICAgICAgICAgICBpZiAocHJlZGljYXRlKG5vZGUpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVwbGFjZW1lbnQgPSBwcm9jZXNzTm9kZShub2RlKTtcbiAgICAgICAgICAgICAgICBpZiAocmVwbGFjZW1lbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBub2Rlcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBub2Rlc1tpXSA9IHJlcGxhY2VtZW50O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIWRvbnRVcGRhdGVMYXN0SW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZXMuY2xhaW1faW5mby5sYXN0X2luZGV4ID0gaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gT3RoZXJ3aXNlLCB3ZSB0cnkgdG8gZmluZCBvbmUgYmVmb3JlXG4gICAgICAgIC8vIFdlIGl0ZXJhdGUgaW4gcmV2ZXJzZSBzbyB0aGF0IHdlIGRvbid0IGdvIHRvbyBmYXIgYmFja1xuICAgICAgICBmb3IgKGxldCBpID0gbm9kZXMuY2xhaW1faW5mby5sYXN0X2luZGV4IC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1tpXTtcbiAgICAgICAgICAgIGlmIChwcmVkaWNhdGUobm9kZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXBsYWNlbWVudCA9IHByb2Nlc3NOb2RlKG5vZGUpO1xuICAgICAgICAgICAgICAgIGlmIChyZXBsYWNlbWVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVzW2ldID0gcmVwbGFjZW1lbnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghZG9udFVwZGF0ZUxhc3RJbmRleCkge1xuICAgICAgICAgICAgICAgICAgICBub2Rlcy5jbGFpbV9pbmZvLmxhc3RfaW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChyZXBsYWNlbWVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNpbmNlIHdlIHNwbGljZWQgYmVmb3JlIHRoZSBsYXN0X2luZGV4LCB3ZSBkZWNyZWFzZSBpdFxuICAgICAgICAgICAgICAgICAgICBub2Rlcy5jbGFpbV9pbmZvLmxhc3RfaW5kZXgtLTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgd2UgY2FuJ3QgZmluZCBhbnkgbWF0Y2hpbmcgbm9kZSwgd2UgY3JlYXRlIGEgbmV3IG9uZVxuICAgICAgICByZXR1cm4gY3JlYXRlTm9kZSgpO1xuICAgIH0pKCk7XG4gICAgcmVzdWx0Tm9kZS5jbGFpbV9vcmRlciA9IG5vZGVzLmNsYWltX2luZm8udG90YWxfY2xhaW1lZDtcbiAgICBub2Rlcy5jbGFpbV9pbmZvLnRvdGFsX2NsYWltZWQgKz0gMTtcbiAgICByZXR1cm4gcmVzdWx0Tm9kZTtcbn1cbmZ1bmN0aW9uIGNsYWltX2VsZW1lbnRfYmFzZShub2RlcywgbmFtZSwgYXR0cmlidXRlcywgY3JlYXRlX2VsZW1lbnQpIHtcbiAgICByZXR1cm4gY2xhaW1fbm9kZShub2RlcywgKG5vZGUpID0+IG5vZGUubm9kZU5hbWUgPT09IG5hbWUsIChub2RlKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlbW92ZSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG5vZGUuYXR0cmlidXRlcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlID0gbm9kZS5hdHRyaWJ1dGVzW2pdO1xuICAgICAgICAgICAgaWYgKCFhdHRyaWJ1dGVzW2F0dHJpYnV0ZS5uYW1lXSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZS5wdXNoKGF0dHJpYnV0ZS5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZW1vdmUuZm9yRWFjaCh2ID0+IG5vZGUucmVtb3ZlQXR0cmlidXRlKHYpKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9LCAoKSA9PiBjcmVhdGVfZWxlbWVudChuYW1lKSk7XG59XG5mdW5jdGlvbiBjbGFpbV9lbGVtZW50KG5vZGVzLCBuYW1lLCBhdHRyaWJ1dGVzKSB7XG4gICAgcmV0dXJuIGNsYWltX2VsZW1lbnRfYmFzZShub2RlcywgbmFtZSwgYXR0cmlidXRlcywgZWxlbWVudCk7XG59XG5mdW5jdGlvbiBjbGFpbV9zdmdfZWxlbWVudChub2RlcywgbmFtZSwgYXR0cmlidXRlcykge1xuICAgIHJldHVybiBjbGFpbV9lbGVtZW50X2Jhc2Uobm9kZXMsIG5hbWUsIGF0dHJpYnV0ZXMsIHN2Z19lbGVtZW50KTtcbn1cbmZ1bmN0aW9uIGNsYWltX3RleHQobm9kZXMsIGRhdGEpIHtcbiAgICByZXR1cm4gY2xhaW1fbm9kZShub2RlcywgKG5vZGUpID0+IG5vZGUubm9kZVR5cGUgPT09IDMsIChub2RlKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGFTdHIgPSAnJyArIGRhdGE7XG4gICAgICAgIGlmIChub2RlLmRhdGEuc3RhcnRzV2l0aChkYXRhU3RyKSkge1xuICAgICAgICAgICAgaWYgKG5vZGUuZGF0YS5sZW5ndGggIT09IGRhdGFTdHIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5vZGUuc3BsaXRUZXh0KGRhdGFTdHIubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG5vZGUuZGF0YSA9IGRhdGFTdHI7XG4gICAgICAgIH1cbiAgICB9LCAoKSA9PiB0ZXh0KGRhdGEpLCB0cnVlIC8vIFRleHQgbm9kZXMgc2hvdWxkIG5vdCB1cGRhdGUgbGFzdCBpbmRleCBzaW5jZSBpdCBpcyBsaWtlbHkgbm90IHdvcnRoIGl0IHRvIGVsaW1pbmF0ZSBhbiBpbmNyZWFzaW5nIHN1YnNlcXVlbmNlIG9mIGFjdHVhbCBlbGVtZW50c1xuICAgICk7XG59XG5mdW5jdGlvbiBjbGFpbV9zcGFjZShub2Rlcykge1xuICAgIHJldHVybiBjbGFpbV90ZXh0KG5vZGVzLCAnICcpO1xufVxuZnVuY3Rpb24gZmluZF9jb21tZW50KG5vZGVzLCB0ZXh0LCBzdGFydCkge1xuICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IG5vZGVzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1tpXTtcbiAgICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDggLyogY29tbWVudCBub2RlICovICYmIG5vZGUudGV4dENvbnRlbnQudHJpbSgpID09PSB0ZXh0KSB7XG4gICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbm9kZXMubGVuZ3RoO1xufVxuZnVuY3Rpb24gY2xhaW1faHRtbF90YWcobm9kZXMpIHtcbiAgICAvLyBmaW5kIGh0bWwgb3BlbmluZyB0YWdcbiAgICBjb25zdCBzdGFydF9pbmRleCA9IGZpbmRfY29tbWVudChub2RlcywgJ0hUTUxfVEFHX1NUQVJUJywgMCk7XG4gICAgY29uc3QgZW5kX2luZGV4ID0gZmluZF9jb21tZW50KG5vZGVzLCAnSFRNTF9UQUdfRU5EJywgc3RhcnRfaW5kZXgpO1xuICAgIGlmIChzdGFydF9pbmRleCA9PT0gZW5kX2luZGV4KSB7XG4gICAgICAgIHJldHVybiBuZXcgSHRtbFRhZ0h5ZHJhdGlvbigpO1xuICAgIH1cbiAgICBpbml0X2NsYWltX2luZm8obm9kZXMpO1xuICAgIGNvbnN0IGh0bWxfdGFnX25vZGVzID0gbm9kZXMuc3BsaWNlKHN0YXJ0X2luZGV4LCBlbmRfaW5kZXggKyAxKTtcbiAgICBkZXRhY2goaHRtbF90YWdfbm9kZXNbMF0pO1xuICAgIGRldGFjaChodG1sX3RhZ19ub2Rlc1todG1sX3RhZ19ub2Rlcy5sZW5ndGggLSAxXSk7XG4gICAgY29uc3QgY2xhaW1lZF9ub2RlcyA9IGh0bWxfdGFnX25vZGVzLnNsaWNlKDEsIGh0bWxfdGFnX25vZGVzLmxlbmd0aCAtIDEpO1xuICAgIGZvciAoY29uc3QgbiBvZiBjbGFpbWVkX25vZGVzKSB7XG4gICAgICAgIG4uY2xhaW1fb3JkZXIgPSBub2Rlcy5jbGFpbV9pbmZvLnRvdGFsX2NsYWltZWQ7XG4gICAgICAgIG5vZGVzLmNsYWltX2luZm8udG90YWxfY2xhaW1lZCArPSAxO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEh0bWxUYWdIeWRyYXRpb24oY2xhaW1lZF9ub2Rlcyk7XG59XG5mdW5jdGlvbiBzZXRfZGF0YSh0ZXh0LCBkYXRhKSB7XG4gICAgZGF0YSA9ICcnICsgZGF0YTtcbiAgICBpZiAodGV4dC53aG9sZVRleHQgIT09IGRhdGEpXG4gICAgICAgIHRleHQuZGF0YSA9IGRhdGE7XG59XG5mdW5jdGlvbiBzZXRfaW5wdXRfdmFsdWUoaW5wdXQsIHZhbHVlKSB7XG4gICAgaW5wdXQudmFsdWUgPSB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIHNldF9pbnB1dF90eXBlKGlucHV0LCB0eXBlKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaW5wdXQudHlwZSA9IHR5cGU7XG4gICAgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIC8vIGRvIG5vdGhpbmdcbiAgICB9XG59XG5mdW5jdGlvbiBzZXRfc3R5bGUobm9kZSwga2V5LCB2YWx1ZSwgaW1wb3J0YW50KSB7XG4gICAgbm9kZS5zdHlsZS5zZXRQcm9wZXJ0eShrZXksIHZhbHVlLCBpbXBvcnRhbnQgPyAnaW1wb3J0YW50JyA6ICcnKTtcbn1cbmZ1bmN0aW9uIHNlbGVjdF9vcHRpb24oc2VsZWN0LCB2YWx1ZSkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VsZWN0Lm9wdGlvbnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgY29uc3Qgb3B0aW9uID0gc2VsZWN0Lm9wdGlvbnNbaV07XG4gICAgICAgIGlmIChvcHRpb24uX192YWx1ZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIG9wdGlvbi5zZWxlY3RlZCA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG4gICAgc2VsZWN0LnNlbGVjdGVkSW5kZXggPSAtMTsgLy8gbm8gb3B0aW9uIHNob3VsZCBiZSBzZWxlY3RlZFxufVxuZnVuY3Rpb24gc2VsZWN0X29wdGlvbnMoc2VsZWN0LCB2YWx1ZSkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VsZWN0Lm9wdGlvbnMubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgY29uc3Qgb3B0aW9uID0gc2VsZWN0Lm9wdGlvbnNbaV07XG4gICAgICAgIG9wdGlvbi5zZWxlY3RlZCA9IH52YWx1ZS5pbmRleE9mKG9wdGlvbi5fX3ZhbHVlKTtcbiAgICB9XG59XG5mdW5jdGlvbiBzZWxlY3RfdmFsdWUoc2VsZWN0KSB7XG4gICAgY29uc3Qgc2VsZWN0ZWRfb3B0aW9uID0gc2VsZWN0LnF1ZXJ5U2VsZWN0b3IoJzpjaGVja2VkJykgfHwgc2VsZWN0Lm9wdGlvbnNbMF07XG4gICAgcmV0dXJuIHNlbGVjdGVkX29wdGlvbiAmJiBzZWxlY3RlZF9vcHRpb24uX192YWx1ZTtcbn1cbmZ1bmN0aW9uIHNlbGVjdF9tdWx0aXBsZV92YWx1ZShzZWxlY3QpIHtcbiAgICByZXR1cm4gW10ubWFwLmNhbGwoc2VsZWN0LnF1ZXJ5U2VsZWN0b3JBbGwoJzpjaGVja2VkJyksIG9wdGlvbiA9PiBvcHRpb24uX192YWx1ZSk7XG59XG4vLyB1bmZvcnR1bmF0ZWx5IHRoaXMgY2FuJ3QgYmUgYSBjb25zdGFudCBhcyB0aGF0IHdvdWxkbid0IGJlIHRyZWUtc2hha2VhYmxlXG4vLyBzbyB3ZSBjYWNoZSB0aGUgcmVzdWx0IGluc3RlYWRcbmxldCBjcm9zc29yaWdpbjtcbmZ1bmN0aW9uIGlzX2Nyb3Nzb3JpZ2luKCkge1xuICAgIGlmIChjcm9zc29yaWdpbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNyb3Nzb3JpZ2luID0gZmFsc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LnBhcmVudCkge1xuICAgICAgICAgICAgICAgIHZvaWQgd2luZG93LnBhcmVudC5kb2N1bWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNyb3Nzb3JpZ2luID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY3Jvc3NvcmlnaW47XG59XG5mdW5jdGlvbiBhZGRfcmVzaXplX2xpc3RlbmVyKG5vZGUsIGZuKSB7XG4gICAgY29uc3QgY29tcHV0ZWRfc3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKG5vZGUpO1xuICAgIGlmIChjb21wdXRlZF9zdHlsZS5wb3NpdGlvbiA9PT0gJ3N0YXRpYycpIHtcbiAgICAgICAgbm9kZS5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gICAgfVxuICAgIGNvbnN0IGlmcmFtZSA9IGVsZW1lbnQoJ2lmcmFtZScpO1xuICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ3N0eWxlJywgJ2Rpc3BsYXk6IGJsb2NrOyBwb3NpdGlvbjogYWJzb2x1dGU7IHRvcDogMDsgbGVmdDogMDsgd2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsgJyArXG4gICAgICAgICdvdmVyZmxvdzogaGlkZGVuOyBib3JkZXI6IDA7IG9wYWNpdHk6IDA7IHBvaW50ZXItZXZlbnRzOiBub25lOyB6LWluZGV4OiAtMTsnKTtcbiAgICBpZnJhbWUuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG4gICAgaWZyYW1lLnRhYkluZGV4ID0gLTE7XG4gICAgY29uc3QgY3Jvc3NvcmlnaW4gPSBpc19jcm9zc29yaWdpbigpO1xuICAgIGxldCB1bnN1YnNjcmliZTtcbiAgICBpZiAoY3Jvc3NvcmlnaW4pIHtcbiAgICAgICAgaWZyYW1lLnNyYyA9IFwiZGF0YTp0ZXh0L2h0bWwsPHNjcmlwdD5vbnJlc2l6ZT1mdW5jdGlvbigpe3BhcmVudC5wb3N0TWVzc2FnZSgwLCcqJyl9PC9zY3JpcHQ+XCI7XG4gICAgICAgIHVuc3Vic2NyaWJlID0gbGlzdGVuKHdpbmRvdywgJ21lc3NhZ2UnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChldmVudC5zb3VyY2UgPT09IGlmcmFtZS5jb250ZW50V2luZG93KVxuICAgICAgICAgICAgICAgIGZuKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWZyYW1lLnNyYyA9ICdhYm91dDpibGFuayc7XG4gICAgICAgIGlmcmFtZS5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICB1bnN1YnNjcmliZSA9IGxpc3RlbihpZnJhbWUuY29udGVudFdpbmRvdywgJ3Jlc2l6ZScsIGZuKTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgYXBwZW5kKG5vZGUsIGlmcmFtZSk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgaWYgKGNyb3Nzb3JpZ2luKSB7XG4gICAgICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVuc3Vic2NyaWJlICYmIGlmcmFtZS5jb250ZW50V2luZG93KSB7XG4gICAgICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICB9XG4gICAgICAgIGRldGFjaChpZnJhbWUpO1xuICAgIH07XG59XG5mdW5jdGlvbiB0b2dnbGVfY2xhc3MoZWxlbWVudCwgbmFtZSwgdG9nZ2xlKSB7XG4gICAgZWxlbWVudC5jbGFzc0xpc3RbdG9nZ2xlID8gJ2FkZCcgOiAncmVtb3ZlJ10obmFtZSk7XG59XG5mdW5jdGlvbiBjdXN0b21fZXZlbnQodHlwZSwgZGV0YWlsLCBidWJibGVzID0gZmFsc2UpIHtcbiAgICBjb25zdCBlID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0N1c3RvbUV2ZW50Jyk7XG4gICAgZS5pbml0Q3VzdG9tRXZlbnQodHlwZSwgYnViYmxlcywgZmFsc2UsIGRldGFpbCk7XG4gICAgcmV0dXJuIGU7XG59XG5mdW5jdGlvbiBxdWVyeV9zZWxlY3Rvcl9hbGwoc2VsZWN0b3IsIHBhcmVudCA9IGRvY3VtZW50LmJvZHkpIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShwYXJlbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikpO1xufVxuY2xhc3MgSHRtbFRhZyB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuZSA9IHRoaXMubiA9IG51bGw7XG4gICAgfVxuICAgIGMoaHRtbCkge1xuICAgICAgICB0aGlzLmgoaHRtbCk7XG4gICAgfVxuICAgIG0oaHRtbCwgdGFyZ2V0LCBhbmNob3IgPSBudWxsKSB7XG4gICAgICAgIGlmICghdGhpcy5lKSB7XG4gICAgICAgICAgICB0aGlzLmUgPSBlbGVtZW50KHRhcmdldC5ub2RlTmFtZSk7XG4gICAgICAgICAgICB0aGlzLnQgPSB0YXJnZXQ7XG4gICAgICAgICAgICB0aGlzLmMoaHRtbCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pKGFuY2hvcik7XG4gICAgfVxuICAgIGgoaHRtbCkge1xuICAgICAgICB0aGlzLmUuaW5uZXJIVE1MID0gaHRtbDtcbiAgICAgICAgdGhpcy5uID0gQXJyYXkuZnJvbSh0aGlzLmUuY2hpbGROb2Rlcyk7XG4gICAgfVxuICAgIGkoYW5jaG9yKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5uLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICBpbnNlcnQodGhpcy50LCB0aGlzLm5baV0sIGFuY2hvcik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcChodG1sKSB7XG4gICAgICAgIHRoaXMuZCgpO1xuICAgICAgICB0aGlzLmgoaHRtbCk7XG4gICAgICAgIHRoaXMuaSh0aGlzLmEpO1xuICAgIH1cbiAgICBkKCkge1xuICAgICAgICB0aGlzLm4uZm9yRWFjaChkZXRhY2gpO1xuICAgIH1cbn1cbmNsYXNzIEh0bWxUYWdIeWRyYXRpb24gZXh0ZW5kcyBIdG1sVGFnIHtcbiAgICBjb25zdHJ1Y3RvcihjbGFpbWVkX25vZGVzKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZSA9IHRoaXMubiA9IG51bGw7XG4gICAgICAgIHRoaXMubCA9IGNsYWltZWRfbm9kZXM7XG4gICAgfVxuICAgIGMoaHRtbCkge1xuICAgICAgICBpZiAodGhpcy5sKSB7XG4gICAgICAgICAgICB0aGlzLm4gPSB0aGlzLmw7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBzdXBlci5jKGh0bWwpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGkoYW5jaG9yKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5uLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICBpbnNlcnRfaHlkcmF0aW9uKHRoaXMudCwgdGhpcy5uW2ldLCBhbmNob3IpO1xuICAgICAgICB9XG4gICAgfVxufVxuZnVuY3Rpb24gYXR0cmlidXRlX3RvX29iamVjdChhdHRyaWJ1dGVzKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyaWJ1dGUgb2YgYXR0cmlidXRlcykge1xuICAgICAgICByZXN1bHRbYXR0cmlidXRlLm5hbWVdID0gYXR0cmlidXRlLnZhbHVlO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuZnVuY3Rpb24gZ2V0X2N1c3RvbV9lbGVtZW50c19zbG90cyhlbGVtZW50KSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge307XG4gICAgZWxlbWVudC5jaGlsZE5vZGVzLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgcmVzdWx0W25vZGUuc2xvdCB8fCAnZGVmYXVsdCddID0gdHJ1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5jb25zdCBhY3RpdmVfZG9jcyA9IG5ldyBTZXQoKTtcbmxldCBhY3RpdmUgPSAwO1xuLy8gaHR0cHM6Ly9naXRodWIuY29tL2Rhcmtza3lhcHAvc3RyaW5nLWhhc2gvYmxvYi9tYXN0ZXIvaW5kZXguanNcbmZ1bmN0aW9uIGhhc2goc3RyKSB7XG4gICAgbGV0IGhhc2ggPSA1MzgxO1xuICAgIGxldCBpID0gc3RyLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKVxuICAgICAgICBoYXNoID0gKChoYXNoIDw8IDUpIC0gaGFzaCkgXiBzdHIuY2hhckNvZGVBdChpKTtcbiAgICByZXR1cm4gaGFzaCA+Pj4gMDtcbn1cbmZ1bmN0aW9uIGNyZWF0ZV9ydWxlKG5vZGUsIGEsIGIsIGR1cmF0aW9uLCBkZWxheSwgZWFzZSwgZm4sIHVpZCA9IDApIHtcbiAgICBjb25zdCBzdGVwID0gMTYuNjY2IC8gZHVyYXRpb247XG4gICAgbGV0IGtleWZyYW1lcyA9ICd7XFxuJztcbiAgICBmb3IgKGxldCBwID0gMDsgcCA8PSAxOyBwICs9IHN0ZXApIHtcbiAgICAgICAgY29uc3QgdCA9IGEgKyAoYiAtIGEpICogZWFzZShwKTtcbiAgICAgICAga2V5ZnJhbWVzICs9IHAgKiAxMDAgKyBgJXske2ZuKHQsIDEgLSB0KX19XFxuYDtcbiAgICB9XG4gICAgY29uc3QgcnVsZSA9IGtleWZyYW1lcyArIGAxMDAlIHske2ZuKGIsIDEgLSBiKX19XFxufWA7XG4gICAgY29uc3QgbmFtZSA9IGBfX3N2ZWx0ZV8ke2hhc2gocnVsZSl9XyR7dWlkfWA7XG4gICAgY29uc3QgZG9jID0gZ2V0X3Jvb3RfZm9yX3N0eWxlKG5vZGUpO1xuICAgIGFjdGl2ZV9kb2NzLmFkZChkb2MpO1xuICAgIGNvbnN0IHN0eWxlc2hlZXQgPSBkb2MuX19zdmVsdGVfc3R5bGVzaGVldCB8fCAoZG9jLl9fc3ZlbHRlX3N0eWxlc2hlZXQgPSBhcHBlbmRfZW1wdHlfc3R5bGVzaGVldChub2RlKS5zaGVldCk7XG4gICAgY29uc3QgY3VycmVudF9ydWxlcyA9IGRvYy5fX3N2ZWx0ZV9ydWxlcyB8fCAoZG9jLl9fc3ZlbHRlX3J1bGVzID0ge30pO1xuICAgIGlmICghY3VycmVudF9ydWxlc1tuYW1lXSkge1xuICAgICAgICBjdXJyZW50X3J1bGVzW25hbWVdID0gdHJ1ZTtcbiAgICAgICAgc3R5bGVzaGVldC5pbnNlcnRSdWxlKGBAa2V5ZnJhbWVzICR7bmFtZX0gJHtydWxlfWAsIHN0eWxlc2hlZXQuY3NzUnVsZXMubGVuZ3RoKTtcbiAgICB9XG4gICAgY29uc3QgYW5pbWF0aW9uID0gbm9kZS5zdHlsZS5hbmltYXRpb24gfHwgJyc7XG4gICAgbm9kZS5zdHlsZS5hbmltYXRpb24gPSBgJHthbmltYXRpb24gPyBgJHthbmltYXRpb259LCBgIDogJyd9JHtuYW1lfSAke2R1cmF0aW9ufW1zIGxpbmVhciAke2RlbGF5fW1zIDEgYm90aGA7XG4gICAgYWN0aXZlICs9IDE7XG4gICAgcmV0dXJuIG5hbWU7XG59XG5mdW5jdGlvbiBkZWxldGVfcnVsZShub2RlLCBuYW1lKSB7XG4gICAgY29uc3QgcHJldmlvdXMgPSAobm9kZS5zdHlsZS5hbmltYXRpb24gfHwgJycpLnNwbGl0KCcsICcpO1xuICAgIGNvbnN0IG5leHQgPSBwcmV2aW91cy5maWx0ZXIobmFtZVxuICAgICAgICA/IGFuaW0gPT4gYW5pbS5pbmRleE9mKG5hbWUpIDwgMCAvLyByZW1vdmUgc3BlY2lmaWMgYW5pbWF0aW9uXG4gICAgICAgIDogYW5pbSA9PiBhbmltLmluZGV4T2YoJ19fc3ZlbHRlJykgPT09IC0xIC8vIHJlbW92ZSBhbGwgU3ZlbHRlIGFuaW1hdGlvbnNcbiAgICApO1xuICAgIGNvbnN0IGRlbGV0ZWQgPSBwcmV2aW91cy5sZW5ndGggLSBuZXh0Lmxlbmd0aDtcbiAgICBpZiAoZGVsZXRlZCkge1xuICAgICAgICBub2RlLnN0eWxlLmFuaW1hdGlvbiA9IG5leHQuam9pbignLCAnKTtcbiAgICAgICAgYWN0aXZlIC09IGRlbGV0ZWQ7XG4gICAgICAgIGlmICghYWN0aXZlKVxuICAgICAgICAgICAgY2xlYXJfcnVsZXMoKTtcbiAgICB9XG59XG5mdW5jdGlvbiBjbGVhcl9ydWxlcygpIHtcbiAgICByYWYoKCkgPT4ge1xuICAgICAgICBpZiAoYWN0aXZlKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBhY3RpdmVfZG9jcy5mb3JFYWNoKGRvYyA9PiB7XG4gICAgICAgICAgICBjb25zdCBzdHlsZXNoZWV0ID0gZG9jLl9fc3ZlbHRlX3N0eWxlc2hlZXQ7XG4gICAgICAgICAgICBsZXQgaSA9IHN0eWxlc2hlZXQuY3NzUnVsZXMubGVuZ3RoO1xuICAgICAgICAgICAgd2hpbGUgKGktLSlcbiAgICAgICAgICAgICAgICBzdHlsZXNoZWV0LmRlbGV0ZVJ1bGUoaSk7XG4gICAgICAgICAgICBkb2MuX19zdmVsdGVfcnVsZXMgPSB7fTtcbiAgICAgICAgfSk7XG4gICAgICAgIGFjdGl2ZV9kb2NzLmNsZWFyKCk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZV9hbmltYXRpb24obm9kZSwgZnJvbSwgZm4sIHBhcmFtcykge1xuICAgIGlmICghZnJvbSlcbiAgICAgICAgcmV0dXJuIG5vb3A7XG4gICAgY29uc3QgdG8gPSBub2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIGlmIChmcm9tLmxlZnQgPT09IHRvLmxlZnQgJiYgZnJvbS5yaWdodCA9PT0gdG8ucmlnaHQgJiYgZnJvbS50b3AgPT09IHRvLnRvcCAmJiBmcm9tLmJvdHRvbSA9PT0gdG8uYm90dG9tKVxuICAgICAgICByZXR1cm4gbm9vcDtcbiAgICBjb25zdCB7IGRlbGF5ID0gMCwgZHVyYXRpb24gPSAzMDAsIGVhc2luZyA9IGlkZW50aXR5LCBcbiAgICAvLyBAdHMtaWdub3JlIHRvZG86IHNob3VsZCB0aGlzIGJlIHNlcGFyYXRlZCBmcm9tIGRlc3RydWN0dXJpbmc/IE9yIHN0YXJ0L2VuZCBhZGRlZCB0byBwdWJsaWMgYXBpIGFuZCBkb2N1bWVudGF0aW9uP1xuICAgIHN0YXJ0OiBzdGFydF90aW1lID0gbm93KCkgKyBkZWxheSwgXG4gICAgLy8gQHRzLWlnbm9yZSB0b2RvOlxuICAgIGVuZCA9IHN0YXJ0X3RpbWUgKyBkdXJhdGlvbiwgdGljayA9IG5vb3AsIGNzcyB9ID0gZm4obm9kZSwgeyBmcm9tLCB0byB9LCBwYXJhbXMpO1xuICAgIGxldCBydW5uaW5nID0gdHJ1ZTtcbiAgICBsZXQgc3RhcnRlZCA9IGZhbHNlO1xuICAgIGxldCBuYW1lO1xuICAgIGZ1bmN0aW9uIHN0YXJ0KCkge1xuICAgICAgICBpZiAoY3NzKSB7XG4gICAgICAgICAgICBuYW1lID0gY3JlYXRlX3J1bGUobm9kZSwgMCwgMSwgZHVyYXRpb24sIGRlbGF5LCBlYXNpbmcsIGNzcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFkZWxheSkge1xuICAgICAgICAgICAgc3RhcnRlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gc3RvcCgpIHtcbiAgICAgICAgaWYgKGNzcylcbiAgICAgICAgICAgIGRlbGV0ZV9ydWxlKG5vZGUsIG5hbWUpO1xuICAgICAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgfVxuICAgIGxvb3Aobm93ID0+IHtcbiAgICAgICAgaWYgKCFzdGFydGVkICYmIG5vdyA+PSBzdGFydF90aW1lKSB7XG4gICAgICAgICAgICBzdGFydGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhcnRlZCAmJiBub3cgPj0gZW5kKSB7XG4gICAgICAgICAgICB0aWNrKDEsIDApO1xuICAgICAgICAgICAgc3RvcCgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcnVubmluZykge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGFydGVkKSB7XG4gICAgICAgICAgICBjb25zdCBwID0gbm93IC0gc3RhcnRfdGltZTtcbiAgICAgICAgICAgIGNvbnN0IHQgPSAwICsgMSAqIGVhc2luZyhwIC8gZHVyYXRpb24pO1xuICAgICAgICAgICAgdGljayh0LCAxIC0gdCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gICAgc3RhcnQoKTtcbiAgICB0aWNrKDAsIDEpO1xuICAgIHJldHVybiBzdG9wO1xufVxuZnVuY3Rpb24gZml4X3Bvc2l0aW9uKG5vZGUpIHtcbiAgICBjb25zdCBzdHlsZSA9IGdldENvbXB1dGVkU3R5bGUobm9kZSk7XG4gICAgaWYgKHN0eWxlLnBvc2l0aW9uICE9PSAnYWJzb2x1dGUnICYmIHN0eWxlLnBvc2l0aW9uICE9PSAnZml4ZWQnKSB7XG4gICAgICAgIGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gc3R5bGU7XG4gICAgICAgIGNvbnN0IGEgPSBub2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICBub2RlLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgbm9kZS5zdHlsZS53aWR0aCA9IHdpZHRoO1xuICAgICAgICBub2RlLnN0eWxlLmhlaWdodCA9IGhlaWdodDtcbiAgICAgICAgYWRkX3RyYW5zZm9ybShub2RlLCBhKTtcbiAgICB9XG59XG5mdW5jdGlvbiBhZGRfdHJhbnNmb3JtKG5vZGUsIGEpIHtcbiAgICBjb25zdCBiID0gbm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICBpZiAoYS5sZWZ0ICE9PSBiLmxlZnQgfHwgYS50b3AgIT09IGIudG9wKSB7XG4gICAgICAgIGNvbnN0IHN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShub2RlKTtcbiAgICAgICAgY29uc3QgdHJhbnNmb3JtID0gc3R5bGUudHJhbnNmb3JtID09PSAnbm9uZScgPyAnJyA6IHN0eWxlLnRyYW5zZm9ybTtcbiAgICAgICAgbm9kZS5zdHlsZS50cmFuc2Zvcm0gPSBgJHt0cmFuc2Zvcm19IHRyYW5zbGF0ZSgke2EubGVmdCAtIGIubGVmdH1weCwgJHthLnRvcCAtIGIudG9wfXB4KWA7XG4gICAgfVxufVxuXG5sZXQgY3VycmVudF9jb21wb25lbnQ7XG5mdW5jdGlvbiBzZXRfY3VycmVudF9jb21wb25lbnQoY29tcG9uZW50KSB7XG4gICAgY3VycmVudF9jb21wb25lbnQgPSBjb21wb25lbnQ7XG59XG5mdW5jdGlvbiBnZXRfY3VycmVudF9jb21wb25lbnQoKSB7XG4gICAgaWYgKCFjdXJyZW50X2NvbXBvbmVudClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGdW5jdGlvbiBjYWxsZWQgb3V0c2lkZSBjb21wb25lbnQgaW5pdGlhbGl6YXRpb24nKTtcbiAgICByZXR1cm4gY3VycmVudF9jb21wb25lbnQ7XG59XG5mdW5jdGlvbiBiZWZvcmVVcGRhdGUoZm4pIHtcbiAgICBnZXRfY3VycmVudF9jb21wb25lbnQoKS4kJC5iZWZvcmVfdXBkYXRlLnB1c2goZm4pO1xufVxuZnVuY3Rpb24gb25Nb3VudChmbikge1xuICAgIGdldF9jdXJyZW50X2NvbXBvbmVudCgpLiQkLm9uX21vdW50LnB1c2goZm4pO1xufVxuZnVuY3Rpb24gYWZ0ZXJVcGRhdGUoZm4pIHtcbiAgICBnZXRfY3VycmVudF9jb21wb25lbnQoKS4kJC5hZnRlcl91cGRhdGUucHVzaChmbik7XG59XG5mdW5jdGlvbiBvbkRlc3Ryb3koZm4pIHtcbiAgICBnZXRfY3VycmVudF9jb21wb25lbnQoKS4kJC5vbl9kZXN0cm95LnB1c2goZm4pO1xufVxuZnVuY3Rpb24gY3JlYXRlRXZlbnREaXNwYXRjaGVyKCkge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IGdldF9jdXJyZW50X2NvbXBvbmVudCgpO1xuICAgIHJldHVybiAodHlwZSwgZGV0YWlsKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IGNvbXBvbmVudC4kJC5jYWxsYmFja3NbdHlwZV07XG4gICAgICAgIGlmIChjYWxsYmFja3MpIHtcbiAgICAgICAgICAgIC8vIFRPRE8gYXJlIHRoZXJlIHNpdHVhdGlvbnMgd2hlcmUgZXZlbnRzIGNvdWxkIGJlIGRpc3BhdGNoZWRcbiAgICAgICAgICAgIC8vIGluIGEgc2VydmVyIChub24tRE9NKSBlbnZpcm9ubWVudD9cbiAgICAgICAgICAgIGNvbnN0IGV2ZW50ID0gY3VzdG9tX2V2ZW50KHR5cGUsIGRldGFpbCk7XG4gICAgICAgICAgICBjYWxsYmFja3Muc2xpY2UoKS5mb3JFYWNoKGZuID0+IHtcbiAgICAgICAgICAgICAgICBmbi5jYWxsKGNvbXBvbmVudCwgZXZlbnQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuZnVuY3Rpb24gc2V0Q29udGV4dChrZXksIGNvbnRleHQpIHtcbiAgICBnZXRfY3VycmVudF9jb21wb25lbnQoKS4kJC5jb250ZXh0LnNldChrZXksIGNvbnRleHQpO1xufVxuZnVuY3Rpb24gZ2V0Q29udGV4dChrZXkpIHtcbiAgICByZXR1cm4gZ2V0X2N1cnJlbnRfY29tcG9uZW50KCkuJCQuY29udGV4dC5nZXQoa2V5KTtcbn1cbmZ1bmN0aW9uIGdldEFsbENvbnRleHRzKCkge1xuICAgIHJldHVybiBnZXRfY3VycmVudF9jb21wb25lbnQoKS4kJC5jb250ZXh0O1xufVxuZnVuY3Rpb24gaGFzQ29udGV4dChrZXkpIHtcbiAgICByZXR1cm4gZ2V0X2N1cnJlbnRfY29tcG9uZW50KCkuJCQuY29udGV4dC5oYXMoa2V5KTtcbn1cbi8vIFRPRE8gZmlndXJlIG91dCBpZiB3ZSBzdGlsbCB3YW50IHRvIHN1cHBvcnRcbi8vIHNob3J0aGFuZCBldmVudHMsIG9yIGlmIHdlIHdhbnQgdG8gaW1wbGVtZW50XG4vLyBhIHJlYWwgYnViYmxpbmcgbWVjaGFuaXNtXG5mdW5jdGlvbiBidWJibGUoY29tcG9uZW50LCBldmVudCkge1xuICAgIGNvbnN0IGNhbGxiYWNrcyA9IGNvbXBvbmVudC4kJC5jYWxsYmFja3NbZXZlbnQudHlwZV07XG4gICAgaWYgKGNhbGxiYWNrcykge1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGNhbGxiYWNrcy5zbGljZSgpLmZvckVhY2goZm4gPT4gZm4uY2FsbCh0aGlzLCBldmVudCkpO1xuICAgIH1cbn1cblxuY29uc3QgZGlydHlfY29tcG9uZW50cyA9IFtdO1xuY29uc3QgaW50cm9zID0geyBlbmFibGVkOiBmYWxzZSB9O1xuY29uc3QgYmluZGluZ19jYWxsYmFja3MgPSBbXTtcbmNvbnN0IHJlbmRlcl9jYWxsYmFja3MgPSBbXTtcbmNvbnN0IGZsdXNoX2NhbGxiYWNrcyA9IFtdO1xuY29uc3QgcmVzb2x2ZWRfcHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xubGV0IHVwZGF0ZV9zY2hlZHVsZWQgPSBmYWxzZTtcbmZ1bmN0aW9uIHNjaGVkdWxlX3VwZGF0ZSgpIHtcbiAgICBpZiAoIXVwZGF0ZV9zY2hlZHVsZWQpIHtcbiAgICAgICAgdXBkYXRlX3NjaGVkdWxlZCA9IHRydWU7XG4gICAgICAgIHJlc29sdmVkX3Byb21pc2UudGhlbihmbHVzaCk7XG4gICAgfVxufVxuZnVuY3Rpb24gdGljaygpIHtcbiAgICBzY2hlZHVsZV91cGRhdGUoKTtcbiAgICByZXR1cm4gcmVzb2x2ZWRfcHJvbWlzZTtcbn1cbmZ1bmN0aW9uIGFkZF9yZW5kZXJfY2FsbGJhY2soZm4pIHtcbiAgICByZW5kZXJfY2FsbGJhY2tzLnB1c2goZm4pO1xufVxuZnVuY3Rpb24gYWRkX2ZsdXNoX2NhbGxiYWNrKGZuKSB7XG4gICAgZmx1c2hfY2FsbGJhY2tzLnB1c2goZm4pO1xufVxubGV0IGZsdXNoaW5nID0gZmFsc2U7XG5jb25zdCBzZWVuX2NhbGxiYWNrcyA9IG5ldyBTZXQoKTtcbmZ1bmN0aW9uIGZsdXNoKCkge1xuICAgIGlmIChmbHVzaGluZylcbiAgICAgICAgcmV0dXJuO1xuICAgIGZsdXNoaW5nID0gdHJ1ZTtcbiAgICBkbyB7XG4gICAgICAgIC8vIGZpcnN0LCBjYWxsIGJlZm9yZVVwZGF0ZSBmdW5jdGlvbnNcbiAgICAgICAgLy8gYW5kIHVwZGF0ZSBjb21wb25lbnRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGlydHlfY29tcG9uZW50cy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gZGlydHlfY29tcG9uZW50c1tpXTtcbiAgICAgICAgICAgIHNldF9jdXJyZW50X2NvbXBvbmVudChjb21wb25lbnQpO1xuICAgICAgICAgICAgdXBkYXRlKGNvbXBvbmVudC4kJCk7XG4gICAgICAgIH1cbiAgICAgICAgc2V0X2N1cnJlbnRfY29tcG9uZW50KG51bGwpO1xuICAgICAgICBkaXJ0eV9jb21wb25lbnRzLmxlbmd0aCA9IDA7XG4gICAgICAgIHdoaWxlIChiaW5kaW5nX2NhbGxiYWNrcy5sZW5ndGgpXG4gICAgICAgICAgICBiaW5kaW5nX2NhbGxiYWNrcy5wb3AoKSgpO1xuICAgICAgICAvLyB0aGVuLCBvbmNlIGNvbXBvbmVudHMgYXJlIHVwZGF0ZWQsIGNhbGxcbiAgICAgICAgLy8gYWZ0ZXJVcGRhdGUgZnVuY3Rpb25zLiBUaGlzIG1heSBjYXVzZVxuICAgICAgICAvLyBzdWJzZXF1ZW50IHVwZGF0ZXMuLi5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJfY2FsbGJhY2tzLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICBjb25zdCBjYWxsYmFjayA9IHJlbmRlcl9jYWxsYmFja3NbaV07XG4gICAgICAgICAgICBpZiAoIXNlZW5fY2FsbGJhY2tzLmhhcyhjYWxsYmFjaykpIHtcbiAgICAgICAgICAgICAgICAvLyAuLi5zbyBndWFyZCBhZ2FpbnN0IGluZmluaXRlIGxvb3BzXG4gICAgICAgICAgICAgICAgc2Vlbl9jYWxsYmFja3MuYWRkKGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlbmRlcl9jYWxsYmFja3MubGVuZ3RoID0gMDtcbiAgICB9IHdoaWxlIChkaXJ0eV9jb21wb25lbnRzLmxlbmd0aCk7XG4gICAgd2hpbGUgKGZsdXNoX2NhbGxiYWNrcy5sZW5ndGgpIHtcbiAgICAgICAgZmx1c2hfY2FsbGJhY2tzLnBvcCgpKCk7XG4gICAgfVxuICAgIHVwZGF0ZV9zY2hlZHVsZWQgPSBmYWxzZTtcbiAgICBmbHVzaGluZyA9IGZhbHNlO1xuICAgIHNlZW5fY2FsbGJhY2tzLmNsZWFyKCk7XG59XG5mdW5jdGlvbiB1cGRhdGUoJCQpIHtcbiAgICBpZiAoJCQuZnJhZ21lbnQgIT09IG51bGwpIHtcbiAgICAgICAgJCQudXBkYXRlKCk7XG4gICAgICAgIHJ1bl9hbGwoJCQuYmVmb3JlX3VwZGF0ZSk7XG4gICAgICAgIGNvbnN0IGRpcnR5ID0gJCQuZGlydHk7XG4gICAgICAgICQkLmRpcnR5ID0gWy0xXTtcbiAgICAgICAgJCQuZnJhZ21lbnQgJiYgJCQuZnJhZ21lbnQucCgkJC5jdHgsIGRpcnR5KTtcbiAgICAgICAgJCQuYWZ0ZXJfdXBkYXRlLmZvckVhY2goYWRkX3JlbmRlcl9jYWxsYmFjayk7XG4gICAgfVxufVxuXG5sZXQgcHJvbWlzZTtcbmZ1bmN0aW9uIHdhaXQoKSB7XG4gICAgaWYgKCFwcm9taXNlKSB7XG4gICAgICAgIHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgcHJvbWlzZS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIHByb21pc2UgPSBudWxsO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHByb21pc2U7XG59XG5mdW5jdGlvbiBkaXNwYXRjaChub2RlLCBkaXJlY3Rpb24sIGtpbmQpIHtcbiAgICBub2RlLmRpc3BhdGNoRXZlbnQoY3VzdG9tX2V2ZW50KGAke2RpcmVjdGlvbiA/ICdpbnRybycgOiAnb3V0cm8nfSR7a2luZH1gKSk7XG59XG5jb25zdCBvdXRyb2luZyA9IG5ldyBTZXQoKTtcbmxldCBvdXRyb3M7XG5mdW5jdGlvbiBncm91cF9vdXRyb3MoKSB7XG4gICAgb3V0cm9zID0ge1xuICAgICAgICByOiAwLFxuICAgICAgICBjOiBbXSxcbiAgICAgICAgcDogb3V0cm9zIC8vIHBhcmVudCBncm91cFxuICAgIH07XG59XG5mdW5jdGlvbiBjaGVja19vdXRyb3MoKSB7XG4gICAgaWYgKCFvdXRyb3Mucikge1xuICAgICAgICBydW5fYWxsKG91dHJvcy5jKTtcbiAgICB9XG4gICAgb3V0cm9zID0gb3V0cm9zLnA7XG59XG5mdW5jdGlvbiB0cmFuc2l0aW9uX2luKGJsb2NrLCBsb2NhbCkge1xuICAgIGlmIChibG9jayAmJiBibG9jay5pKSB7XG4gICAgICAgIG91dHJvaW5nLmRlbGV0ZShibG9jayk7XG4gICAgICAgIGJsb2NrLmkobG9jYWwpO1xuICAgIH1cbn1cbmZ1bmN0aW9uIHRyYW5zaXRpb25fb3V0KGJsb2NrLCBsb2NhbCwgZGV0YWNoLCBjYWxsYmFjaykge1xuICAgIGlmIChibG9jayAmJiBibG9jay5vKSB7XG4gICAgICAgIGlmIChvdXRyb2luZy5oYXMoYmxvY2spKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBvdXRyb2luZy5hZGQoYmxvY2spO1xuICAgICAgICBvdXRyb3MuYy5wdXNoKCgpID0+IHtcbiAgICAgICAgICAgIG91dHJvaW5nLmRlbGV0ZShibG9jayk7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAoZGV0YWNoKVxuICAgICAgICAgICAgICAgICAgICBibG9jay5kKDEpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBibG9jay5vKGxvY2FsKTtcbiAgICB9XG59XG5jb25zdCBudWxsX3RyYW5zaXRpb24gPSB7IGR1cmF0aW9uOiAwIH07XG5mdW5jdGlvbiBjcmVhdGVfaW5fdHJhbnNpdGlvbihub2RlLCBmbiwgcGFyYW1zKSB7XG4gICAgbGV0IGNvbmZpZyA9IGZuKG5vZGUsIHBhcmFtcyk7XG4gICAgbGV0IHJ1bm5pbmcgPSBmYWxzZTtcbiAgICBsZXQgYW5pbWF0aW9uX25hbWU7XG4gICAgbGV0IHRhc2s7XG4gICAgbGV0IHVpZCA9IDA7XG4gICAgZnVuY3Rpb24gY2xlYW51cCgpIHtcbiAgICAgICAgaWYgKGFuaW1hdGlvbl9uYW1lKVxuICAgICAgICAgICAgZGVsZXRlX3J1bGUobm9kZSwgYW5pbWF0aW9uX25hbWUpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBnbygpIHtcbiAgICAgICAgY29uc3QgeyBkZWxheSA9IDAsIGR1cmF0aW9uID0gMzAwLCBlYXNpbmcgPSBpZGVudGl0eSwgdGljayA9IG5vb3AsIGNzcyB9ID0gY29uZmlnIHx8IG51bGxfdHJhbnNpdGlvbjtcbiAgICAgICAgaWYgKGNzcylcbiAgICAgICAgICAgIGFuaW1hdGlvbl9uYW1lID0gY3JlYXRlX3J1bGUobm9kZSwgMCwgMSwgZHVyYXRpb24sIGRlbGF5LCBlYXNpbmcsIGNzcywgdWlkKyspO1xuICAgICAgICB0aWNrKDAsIDEpO1xuICAgICAgICBjb25zdCBzdGFydF90aW1lID0gbm93KCkgKyBkZWxheTtcbiAgICAgICAgY29uc3QgZW5kX3RpbWUgPSBzdGFydF90aW1lICsgZHVyYXRpb247XG4gICAgICAgIGlmICh0YXNrKVxuICAgICAgICAgICAgdGFzay5hYm9ydCgpO1xuICAgICAgICBydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgYWRkX3JlbmRlcl9jYWxsYmFjaygoKSA9PiBkaXNwYXRjaChub2RlLCB0cnVlLCAnc3RhcnQnKSk7XG4gICAgICAgIHRhc2sgPSBsb29wKG5vdyA9PiB7XG4gICAgICAgICAgICBpZiAocnVubmluZykge1xuICAgICAgICAgICAgICAgIGlmIChub3cgPj0gZW5kX3RpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGljaygxLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgZGlzcGF0Y2gobm9kZSwgdHJ1ZSwgJ2VuZCcpO1xuICAgICAgICAgICAgICAgICAgICBjbGVhbnVwKCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBydW5uaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChub3cgPj0gc3RhcnRfdGltZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0ID0gZWFzaW5nKChub3cgLSBzdGFydF90aW1lKSAvIGR1cmF0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgdGljayh0LCAxIC0gdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJ1bm5pbmc7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBsZXQgc3RhcnRlZCA9IGZhbHNlO1xuICAgIHJldHVybiB7XG4gICAgICAgIHN0YXJ0KCkge1xuICAgICAgICAgICAgaWYgKHN0YXJ0ZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgc3RhcnRlZCA9IHRydWU7XG4gICAgICAgICAgICBkZWxldGVfcnVsZShub2RlKTtcbiAgICAgICAgICAgIGlmIChpc19mdW5jdGlvbihjb25maWcpKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnID0gY29uZmlnKCk7XG4gICAgICAgICAgICAgICAgd2FpdCgpLnRoZW4oZ28pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgZ28oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW52YWxpZGF0ZSgpIHtcbiAgICAgICAgICAgIHN0YXJ0ZWQgPSBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgZW5kKCkge1xuICAgICAgICAgICAgaWYgKHJ1bm5pbmcpIHtcbiAgICAgICAgICAgICAgICBjbGVhbnVwKCk7XG4gICAgICAgICAgICAgICAgcnVubmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZV9vdXRfdHJhbnNpdGlvbihub2RlLCBmbiwgcGFyYW1zKSB7XG4gICAgbGV0IGNvbmZpZyA9IGZuKG5vZGUsIHBhcmFtcyk7XG4gICAgbGV0IHJ1bm5pbmcgPSB0cnVlO1xuICAgIGxldCBhbmltYXRpb25fbmFtZTtcbiAgICBjb25zdCBncm91cCA9IG91dHJvcztcbiAgICBncm91cC5yICs9IDE7XG4gICAgZnVuY3Rpb24gZ28oKSB7XG4gICAgICAgIGNvbnN0IHsgZGVsYXkgPSAwLCBkdXJhdGlvbiA9IDMwMCwgZWFzaW5nID0gaWRlbnRpdHksIHRpY2sgPSBub29wLCBjc3MgfSA9IGNvbmZpZyB8fCBudWxsX3RyYW5zaXRpb247XG4gICAgICAgIGlmIChjc3MpXG4gICAgICAgICAgICBhbmltYXRpb25fbmFtZSA9IGNyZWF0ZV9ydWxlKG5vZGUsIDEsIDAsIGR1cmF0aW9uLCBkZWxheSwgZWFzaW5nLCBjc3MpO1xuICAgICAgICBjb25zdCBzdGFydF90aW1lID0gbm93KCkgKyBkZWxheTtcbiAgICAgICAgY29uc3QgZW5kX3RpbWUgPSBzdGFydF90aW1lICsgZHVyYXRpb247XG4gICAgICAgIGFkZF9yZW5kZXJfY2FsbGJhY2soKCkgPT4gZGlzcGF0Y2gobm9kZSwgZmFsc2UsICdzdGFydCcpKTtcbiAgICAgICAgbG9vcChub3cgPT4ge1xuICAgICAgICAgICAgaWYgKHJ1bm5pbmcpIHtcbiAgICAgICAgICAgICAgICBpZiAobm93ID49IGVuZF90aW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHRpY2soMCwgMSk7XG4gICAgICAgICAgICAgICAgICAgIGRpc3BhdGNoKG5vZGUsIGZhbHNlLCAnZW5kJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghLS1ncm91cC5yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGlzIHdpbGwgcmVzdWx0IGluIGBlbmQoKWAgYmVpbmcgY2FsbGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc28gd2UgZG9uJ3QgbmVlZCB0byBjbGVhbiB1cCBoZXJlXG4gICAgICAgICAgICAgICAgICAgICAgICBydW5fYWxsKGdyb3VwLmMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG5vdyA+PSBzdGFydF90aW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHQgPSBlYXNpbmcoKG5vdyAtIHN0YXJ0X3RpbWUpIC8gZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgICAgICB0aWNrKDEgLSB0LCB0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcnVubmluZztcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChpc19mdW5jdGlvbihjb25maWcpKSB7XG4gICAgICAgIHdhaXQoKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGNvbmZpZyA9IGNvbmZpZygpO1xuICAgICAgICAgICAgZ28oKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBnbygpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBlbmQocmVzZXQpIHtcbiAgICAgICAgICAgIGlmIChyZXNldCAmJiBjb25maWcudGljaykge1xuICAgICAgICAgICAgICAgIGNvbmZpZy50aWNrKDEsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJ1bm5pbmcpIHtcbiAgICAgICAgICAgICAgICBpZiAoYW5pbWF0aW9uX25hbWUpXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZV9ydWxlKG5vZGUsIGFuaW1hdGlvbl9uYW1lKTtcbiAgICAgICAgICAgICAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xufVxuZnVuY3Rpb24gY3JlYXRlX2JpZGlyZWN0aW9uYWxfdHJhbnNpdGlvbihub2RlLCBmbiwgcGFyYW1zLCBpbnRybykge1xuICAgIGxldCBjb25maWcgPSBmbihub2RlLCBwYXJhbXMpO1xuICAgIGxldCB0ID0gaW50cm8gPyAwIDogMTtcbiAgICBsZXQgcnVubmluZ19wcm9ncmFtID0gbnVsbDtcbiAgICBsZXQgcGVuZGluZ19wcm9ncmFtID0gbnVsbDtcbiAgICBsZXQgYW5pbWF0aW9uX25hbWUgPSBudWxsO1xuICAgIGZ1bmN0aW9uIGNsZWFyX2FuaW1hdGlvbigpIHtcbiAgICAgICAgaWYgKGFuaW1hdGlvbl9uYW1lKVxuICAgICAgICAgICAgZGVsZXRlX3J1bGUobm9kZSwgYW5pbWF0aW9uX25hbWUpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpbml0KHByb2dyYW0sIGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGQgPSAocHJvZ3JhbS5iIC0gdCk7XG4gICAgICAgIGR1cmF0aW9uICo9IE1hdGguYWJzKGQpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYTogdCxcbiAgICAgICAgICAgIGI6IHByb2dyYW0uYixcbiAgICAgICAgICAgIGQsXG4gICAgICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgICAgIHN0YXJ0OiBwcm9ncmFtLnN0YXJ0LFxuICAgICAgICAgICAgZW5kOiBwcm9ncmFtLnN0YXJ0ICsgZHVyYXRpb24sXG4gICAgICAgICAgICBncm91cDogcHJvZ3JhbS5ncm91cFxuICAgICAgICB9O1xuICAgIH1cbiAgICBmdW5jdGlvbiBnbyhiKSB7XG4gICAgICAgIGNvbnN0IHsgZGVsYXkgPSAwLCBkdXJhdGlvbiA9IDMwMCwgZWFzaW5nID0gaWRlbnRpdHksIHRpY2sgPSBub29wLCBjc3MgfSA9IGNvbmZpZyB8fCBudWxsX3RyYW5zaXRpb247XG4gICAgICAgIGNvbnN0IHByb2dyYW0gPSB7XG4gICAgICAgICAgICBzdGFydDogbm93KCkgKyBkZWxheSxcbiAgICAgICAgICAgIGJcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKCFiKSB7XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlIHRvZG86IGltcHJvdmUgdHlwaW5nc1xuICAgICAgICAgICAgcHJvZ3JhbS5ncm91cCA9IG91dHJvcztcbiAgICAgICAgICAgIG91dHJvcy5yICs9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJ1bm5pbmdfcHJvZ3JhbSB8fCBwZW5kaW5nX3Byb2dyYW0pIHtcbiAgICAgICAgICAgIHBlbmRpbmdfcHJvZ3JhbSA9IHByb2dyYW07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGFuIGludHJvLCBhbmQgdGhlcmUncyBhIGRlbGF5LCB3ZSBuZWVkIHRvIGRvXG4gICAgICAgICAgICAvLyBhbiBpbml0aWFsIHRpY2sgYW5kL29yIGFwcGx5IENTUyBhbmltYXRpb24gaW1tZWRpYXRlbHlcbiAgICAgICAgICAgIGlmIChjc3MpIHtcbiAgICAgICAgICAgICAgICBjbGVhcl9hbmltYXRpb24oKTtcbiAgICAgICAgICAgICAgICBhbmltYXRpb25fbmFtZSA9IGNyZWF0ZV9ydWxlKG5vZGUsIHQsIGIsIGR1cmF0aW9uLCBkZWxheSwgZWFzaW5nLCBjc3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGIpXG4gICAgICAgICAgICAgICAgdGljaygwLCAxKTtcbiAgICAgICAgICAgIHJ1bm5pbmdfcHJvZ3JhbSA9IGluaXQocHJvZ3JhbSwgZHVyYXRpb24pO1xuICAgICAgICAgICAgYWRkX3JlbmRlcl9jYWxsYmFjaygoKSA9PiBkaXNwYXRjaChub2RlLCBiLCAnc3RhcnQnKSk7XG4gICAgICAgICAgICBsb29wKG5vdyA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHBlbmRpbmdfcHJvZ3JhbSAmJiBub3cgPiBwZW5kaW5nX3Byb2dyYW0uc3RhcnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcnVubmluZ19wcm9ncmFtID0gaW5pdChwZW5kaW5nX3Byb2dyYW0sIGR1cmF0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgcGVuZGluZ19wcm9ncmFtID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgZGlzcGF0Y2gobm9kZSwgcnVubmluZ19wcm9ncmFtLmIsICdzdGFydCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY3NzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhcl9hbmltYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuaW1hdGlvbl9uYW1lID0gY3JlYXRlX3J1bGUobm9kZSwgdCwgcnVubmluZ19wcm9ncmFtLmIsIHJ1bm5pbmdfcHJvZ3JhbS5kdXJhdGlvbiwgMCwgZWFzaW5nLCBjb25maWcuY3NzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocnVubmluZ19wcm9ncmFtKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub3cgPj0gcnVubmluZ19wcm9ncmFtLmVuZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGljayh0ID0gcnVubmluZ19wcm9ncmFtLmIsIDEgLSB0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc3BhdGNoKG5vZGUsIHJ1bm5pbmdfcHJvZ3JhbS5iLCAnZW5kJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXBlbmRpbmdfcHJvZ3JhbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdlJ3JlIGRvbmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocnVubmluZ19wcm9ncmFtLmIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW50cm8g4oCUIHdlIGNhbiB0aWR5IHVwIGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFyX2FuaW1hdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gb3V0cm8g4oCUIG5lZWRzIHRvIGJlIGNvb3JkaW5hdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghLS1ydW5uaW5nX3Byb2dyYW0uZ3JvdXAucilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bl9hbGwocnVubmluZ19wcm9ncmFtLmdyb3VwLmMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJ1bm5pbmdfcHJvZ3JhbSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAobm93ID49IHJ1bm5pbmdfcHJvZ3JhbS5zdGFydCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcCA9IG5vdyAtIHJ1bm5pbmdfcHJvZ3JhbS5zdGFydDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHQgPSBydW5uaW5nX3Byb2dyYW0uYSArIHJ1bm5pbmdfcHJvZ3JhbS5kICogZWFzaW5nKHAgLyBydW5uaW5nX3Byb2dyYW0uZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGljayh0LCAxIC0gdCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuICEhKHJ1bm5pbmdfcHJvZ3JhbSB8fCBwZW5kaW5nX3Byb2dyYW0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcnVuKGIpIHtcbiAgICAgICAgICAgIGlmIChpc19mdW5jdGlvbihjb25maWcpKSB7XG4gICAgICAgICAgICAgICAgd2FpdCgpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZyA9IGNvbmZpZygpO1xuICAgICAgICAgICAgICAgICAgICBnbyhiKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGdvKGIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBlbmQoKSB7XG4gICAgICAgICAgICBjbGVhcl9hbmltYXRpb24oKTtcbiAgICAgICAgICAgIHJ1bm5pbmdfcHJvZ3JhbSA9IHBlbmRpbmdfcHJvZ3JhbSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xufVxuXG5mdW5jdGlvbiBoYW5kbGVfcHJvbWlzZShwcm9taXNlLCBpbmZvKSB7XG4gICAgY29uc3QgdG9rZW4gPSBpbmZvLnRva2VuID0ge307XG4gICAgZnVuY3Rpb24gdXBkYXRlKHR5cGUsIGluZGV4LCBrZXksIHZhbHVlKSB7XG4gICAgICAgIGlmIChpbmZvLnRva2VuICE9PSB0b2tlbilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgaW5mby5yZXNvbHZlZCA9IHZhbHVlO1xuICAgICAgICBsZXQgY2hpbGRfY3R4ID0gaW5mby5jdHg7XG4gICAgICAgIGlmIChrZXkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY2hpbGRfY3R4ID0gY2hpbGRfY3R4LnNsaWNlKCk7XG4gICAgICAgICAgICBjaGlsZF9jdHhba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJsb2NrID0gdHlwZSAmJiAoaW5mby5jdXJyZW50ID0gdHlwZSkoY2hpbGRfY3R4KTtcbiAgICAgICAgbGV0IG5lZWRzX2ZsdXNoID0gZmFsc2U7XG4gICAgICAgIGlmIChpbmZvLmJsb2NrKSB7XG4gICAgICAgICAgICBpZiAoaW5mby5ibG9ja3MpIHtcbiAgICAgICAgICAgICAgICBpbmZvLmJsb2Nrcy5mb3JFYWNoKChibG9jaywgaSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaSAhPT0gaW5kZXggJiYgYmxvY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyb3VwX291dHJvcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbl9vdXQoYmxvY2ssIDEsIDEsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5mby5ibG9ja3NbaV0gPT09IGJsb2NrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZm8uYmxvY2tzW2ldID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrX291dHJvcygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbmZvLmJsb2NrLmQoMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBibG9jay5jKCk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uX2luKGJsb2NrLCAxKTtcbiAgICAgICAgICAgIGJsb2NrLm0oaW5mby5tb3VudCgpLCBpbmZvLmFuY2hvcik7XG4gICAgICAgICAgICBuZWVkc19mbHVzaCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaW5mby5ibG9jayA9IGJsb2NrO1xuICAgICAgICBpZiAoaW5mby5ibG9ja3MpXG4gICAgICAgICAgICBpbmZvLmJsb2Nrc1tpbmRleF0gPSBibG9jaztcbiAgICAgICAgaWYgKG5lZWRzX2ZsdXNoKSB7XG4gICAgICAgICAgICBmbHVzaCgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChpc19wcm9taXNlKHByb21pc2UpKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRfY29tcG9uZW50ID0gZ2V0X2N1cnJlbnRfY29tcG9uZW50KCk7XG4gICAgICAgIHByb21pc2UudGhlbih2YWx1ZSA9PiB7XG4gICAgICAgICAgICBzZXRfY3VycmVudF9jb21wb25lbnQoY3VycmVudF9jb21wb25lbnQpO1xuICAgICAgICAgICAgdXBkYXRlKGluZm8udGhlbiwgMSwgaW5mby52YWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgc2V0X2N1cnJlbnRfY29tcG9uZW50KG51bGwpO1xuICAgICAgICB9LCBlcnJvciA9PiB7XG4gICAgICAgICAgICBzZXRfY3VycmVudF9jb21wb25lbnQoY3VycmVudF9jb21wb25lbnQpO1xuICAgICAgICAgICAgdXBkYXRlKGluZm8uY2F0Y2gsIDIsIGluZm8uZXJyb3IsIGVycm9yKTtcbiAgICAgICAgICAgIHNldF9jdXJyZW50X2NvbXBvbmVudChudWxsKTtcbiAgICAgICAgICAgIGlmICghaW5mby5oYXNDYXRjaCkge1xuICAgICAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgLy8gaWYgd2UgcHJldmlvdXNseSBoYWQgYSB0aGVuL2NhdGNoIGJsb2NrLCBkZXN0cm95IGl0XG4gICAgICAgIGlmIChpbmZvLmN1cnJlbnQgIT09IGluZm8ucGVuZGluZykge1xuICAgICAgICAgICAgdXBkYXRlKGluZm8ucGVuZGluZywgMCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKGluZm8uY3VycmVudCAhPT0gaW5mby50aGVuKSB7XG4gICAgICAgICAgICB1cGRhdGUoaW5mby50aGVuLCAxLCBpbmZvLnZhbHVlLCBwcm9taXNlKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGluZm8ucmVzb2x2ZWQgPSBwcm9taXNlO1xuICAgIH1cbn1cbmZ1bmN0aW9uIHVwZGF0ZV9hd2FpdF9ibG9ja19icmFuY2goaW5mbywgY3R4LCBkaXJ0eSkge1xuICAgIGNvbnN0IGNoaWxkX2N0eCA9IGN0eC5zbGljZSgpO1xuICAgIGNvbnN0IHsgcmVzb2x2ZWQgfSA9IGluZm87XG4gICAgaWYgKGluZm8uY3VycmVudCA9PT0gaW5mby50aGVuKSB7XG4gICAgICAgIGNoaWxkX2N0eFtpbmZvLnZhbHVlXSA9IHJlc29sdmVkO1xuICAgIH1cbiAgICBpZiAoaW5mby5jdXJyZW50ID09PSBpbmZvLmNhdGNoKSB7XG4gICAgICAgIGNoaWxkX2N0eFtpbmZvLmVycm9yXSA9IHJlc29sdmVkO1xuICAgIH1cbiAgICBpbmZvLmJsb2NrLnAoY2hpbGRfY3R4LCBkaXJ0eSk7XG59XG5cbmNvbnN0IGdsb2JhbHMgPSAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICA/IHdpbmRvd1xuICAgIDogdHlwZW9mIGdsb2JhbFRoaXMgIT09ICd1bmRlZmluZWQnXG4gICAgICAgID8gZ2xvYmFsVGhpc1xuICAgICAgICA6IGdsb2JhbCk7XG5cbmZ1bmN0aW9uIGRlc3Ryb3lfYmxvY2soYmxvY2ssIGxvb2t1cCkge1xuICAgIGJsb2NrLmQoMSk7XG4gICAgbG9va3VwLmRlbGV0ZShibG9jay5rZXkpO1xufVxuZnVuY3Rpb24gb3V0cm9fYW5kX2Rlc3Ryb3lfYmxvY2soYmxvY2ssIGxvb2t1cCkge1xuICAgIHRyYW5zaXRpb25fb3V0KGJsb2NrLCAxLCAxLCAoKSA9PiB7XG4gICAgICAgIGxvb2t1cC5kZWxldGUoYmxvY2sua2V5KTtcbiAgICB9KTtcbn1cbmZ1bmN0aW9uIGZpeF9hbmRfZGVzdHJveV9ibG9jayhibG9jaywgbG9va3VwKSB7XG4gICAgYmxvY2suZigpO1xuICAgIGRlc3Ryb3lfYmxvY2soYmxvY2ssIGxvb2t1cCk7XG59XG5mdW5jdGlvbiBmaXhfYW5kX291dHJvX2FuZF9kZXN0cm95X2Jsb2NrKGJsb2NrLCBsb29rdXApIHtcbiAgICBibG9jay5mKCk7XG4gICAgb3V0cm9fYW5kX2Rlc3Ryb3lfYmxvY2soYmxvY2ssIGxvb2t1cCk7XG59XG5mdW5jdGlvbiB1cGRhdGVfa2V5ZWRfZWFjaChvbGRfYmxvY2tzLCBkaXJ0eSwgZ2V0X2tleSwgZHluYW1pYywgY3R4LCBsaXN0LCBsb29rdXAsIG5vZGUsIGRlc3Ryb3ksIGNyZWF0ZV9lYWNoX2Jsb2NrLCBuZXh0LCBnZXRfY29udGV4dCkge1xuICAgIGxldCBvID0gb2xkX2Jsb2Nrcy5sZW5ndGg7XG4gICAgbGV0IG4gPSBsaXN0Lmxlbmd0aDtcbiAgICBsZXQgaSA9IG87XG4gICAgY29uc3Qgb2xkX2luZGV4ZXMgPSB7fTtcbiAgICB3aGlsZSAoaS0tKVxuICAgICAgICBvbGRfaW5kZXhlc1tvbGRfYmxvY2tzW2ldLmtleV0gPSBpO1xuICAgIGNvbnN0IG5ld19ibG9ja3MgPSBbXTtcbiAgICBjb25zdCBuZXdfbG9va3VwID0gbmV3IE1hcCgpO1xuICAgIGNvbnN0IGRlbHRhcyA9IG5ldyBNYXAoKTtcbiAgICBpID0gbjtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGNvbnN0IGNoaWxkX2N0eCA9IGdldF9jb250ZXh0KGN0eCwgbGlzdCwgaSk7XG4gICAgICAgIGNvbnN0IGtleSA9IGdldF9rZXkoY2hpbGRfY3R4KTtcbiAgICAgICAgbGV0IGJsb2NrID0gbG9va3VwLmdldChrZXkpO1xuICAgICAgICBpZiAoIWJsb2NrKSB7XG4gICAgICAgICAgICBibG9jayA9IGNyZWF0ZV9lYWNoX2Jsb2NrKGtleSwgY2hpbGRfY3R4KTtcbiAgICAgICAgICAgIGJsb2NrLmMoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChkeW5hbWljKSB7XG4gICAgICAgICAgICBibG9jay5wKGNoaWxkX2N0eCwgZGlydHkpO1xuICAgICAgICB9XG4gICAgICAgIG5ld19sb29rdXAuc2V0KGtleSwgbmV3X2Jsb2Nrc1tpXSA9IGJsb2NrKTtcbiAgICAgICAgaWYgKGtleSBpbiBvbGRfaW5kZXhlcylcbiAgICAgICAgICAgIGRlbHRhcy5zZXQoa2V5LCBNYXRoLmFicyhpIC0gb2xkX2luZGV4ZXNba2V5XSkpO1xuICAgIH1cbiAgICBjb25zdCB3aWxsX21vdmUgPSBuZXcgU2V0KCk7XG4gICAgY29uc3QgZGlkX21vdmUgPSBuZXcgU2V0KCk7XG4gICAgZnVuY3Rpb24gaW5zZXJ0KGJsb2NrKSB7XG4gICAgICAgIHRyYW5zaXRpb25faW4oYmxvY2ssIDEpO1xuICAgICAgICBibG9jay5tKG5vZGUsIG5leHQpO1xuICAgICAgICBsb29rdXAuc2V0KGJsb2NrLmtleSwgYmxvY2spO1xuICAgICAgICBuZXh0ID0gYmxvY2suZmlyc3Q7XG4gICAgICAgIG4tLTtcbiAgICB9XG4gICAgd2hpbGUgKG8gJiYgbikge1xuICAgICAgICBjb25zdCBuZXdfYmxvY2sgPSBuZXdfYmxvY2tzW24gLSAxXTtcbiAgICAgICAgY29uc3Qgb2xkX2Jsb2NrID0gb2xkX2Jsb2Nrc1tvIC0gMV07XG4gICAgICAgIGNvbnN0IG5ld19rZXkgPSBuZXdfYmxvY2sua2V5O1xuICAgICAgICBjb25zdCBvbGRfa2V5ID0gb2xkX2Jsb2NrLmtleTtcbiAgICAgICAgaWYgKG5ld19ibG9jayA9PT0gb2xkX2Jsb2NrKSB7XG4gICAgICAgICAgICAvLyBkbyBub3RoaW5nXG4gICAgICAgICAgICBuZXh0ID0gbmV3X2Jsb2NrLmZpcnN0O1xuICAgICAgICAgICAgby0tO1xuICAgICAgICAgICAgbi0tO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFuZXdfbG9va3VwLmhhcyhvbGRfa2V5KSkge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIG9sZCBibG9ja1xuICAgICAgICAgICAgZGVzdHJveShvbGRfYmxvY2ssIGxvb2t1cCk7XG4gICAgICAgICAgICBvLS07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoIWxvb2t1cC5oYXMobmV3X2tleSkgfHwgd2lsbF9tb3ZlLmhhcyhuZXdfa2V5KSkge1xuICAgICAgICAgICAgaW5zZXJ0KG5ld19ibG9jayk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZGlkX21vdmUuaGFzKG9sZF9rZXkpKSB7XG4gICAgICAgICAgICBvLS07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZGVsdGFzLmdldChuZXdfa2V5KSA+IGRlbHRhcy5nZXQob2xkX2tleSkpIHtcbiAgICAgICAgICAgIGRpZF9tb3ZlLmFkZChuZXdfa2V5KTtcbiAgICAgICAgICAgIGluc2VydChuZXdfYmxvY2spO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgd2lsbF9tb3ZlLmFkZChvbGRfa2V5KTtcbiAgICAgICAgICAgIG8tLTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB3aGlsZSAoby0tKSB7XG4gICAgICAgIGNvbnN0IG9sZF9ibG9jayA9IG9sZF9ibG9ja3Nbb107XG4gICAgICAgIGlmICghbmV3X2xvb2t1cC5oYXMob2xkX2Jsb2NrLmtleSkpXG4gICAgICAgICAgICBkZXN0cm95KG9sZF9ibG9jaywgbG9va3VwKTtcbiAgICB9XG4gICAgd2hpbGUgKG4pXG4gICAgICAgIGluc2VydChuZXdfYmxvY2tzW24gLSAxXSk7XG4gICAgcmV0dXJuIG5ld19ibG9ja3M7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZV9lYWNoX2tleXMoY3R4LCBsaXN0LCBnZXRfY29udGV4dCwgZ2V0X2tleSkge1xuICAgIGNvbnN0IGtleXMgPSBuZXcgU2V0KCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGtleSA9IGdldF9rZXkoZ2V0X2NvbnRleHQoY3R4LCBsaXN0LCBpKSk7XG4gICAgICAgIGlmIChrZXlzLmhhcyhrZXkpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBoYXZlIGR1cGxpY2F0ZSBrZXlzIGluIGEga2V5ZWQgZWFjaCcpO1xuICAgICAgICB9XG4gICAgICAgIGtleXMuYWRkKGtleSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRfc3ByZWFkX3VwZGF0ZShsZXZlbHMsIHVwZGF0ZXMpIHtcbiAgICBjb25zdCB1cGRhdGUgPSB7fTtcbiAgICBjb25zdCB0b19udWxsX291dCA9IHt9O1xuICAgIGNvbnN0IGFjY291bnRlZF9mb3IgPSB7ICQkc2NvcGU6IDEgfTtcbiAgICBsZXQgaSA9IGxldmVscy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgICBjb25zdCBvID0gbGV2ZWxzW2ldO1xuICAgICAgICBjb25zdCBuID0gdXBkYXRlc1tpXTtcbiAgICAgICAgaWYgKG4pIHtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIG8pIHtcbiAgICAgICAgICAgICAgICBpZiAoIShrZXkgaW4gbikpXG4gICAgICAgICAgICAgICAgICAgIHRvX251bGxfb3V0W2tleV0gPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gbikge1xuICAgICAgICAgICAgICAgIGlmICghYWNjb3VudGVkX2ZvcltrZXldKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZVtrZXldID0gbltrZXldO1xuICAgICAgICAgICAgICAgICAgICBhY2NvdW50ZWRfZm9yW2tleV0gPSAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldmVsc1tpXSA9IG47XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBvKSB7XG4gICAgICAgICAgICAgICAgYWNjb3VudGVkX2ZvcltrZXldID0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGtleSBpbiB0b19udWxsX291dCkge1xuICAgICAgICBpZiAoIShrZXkgaW4gdXBkYXRlKSlcbiAgICAgICAgICAgIHVwZGF0ZVtrZXldID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gdXBkYXRlO1xufVxuZnVuY3Rpb24gZ2V0X3NwcmVhZF9vYmplY3Qoc3ByZWFkX3Byb3BzKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBzcHJlYWRfcHJvcHMgPT09ICdvYmplY3QnICYmIHNwcmVhZF9wcm9wcyAhPT0gbnVsbCA/IHNwcmVhZF9wcm9wcyA6IHt9O1xufVxuXG4vLyBzb3VyY2U6IGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL2luZGljZXMuaHRtbFxuY29uc3QgYm9vbGVhbl9hdHRyaWJ1dGVzID0gbmV3IFNldChbXG4gICAgJ2FsbG93ZnVsbHNjcmVlbicsXG4gICAgJ2FsbG93cGF5bWVudHJlcXVlc3QnLFxuICAgICdhc3luYycsXG4gICAgJ2F1dG9mb2N1cycsXG4gICAgJ2F1dG9wbGF5JyxcbiAgICAnY2hlY2tlZCcsXG4gICAgJ2NvbnRyb2xzJyxcbiAgICAnZGVmYXVsdCcsXG4gICAgJ2RlZmVyJyxcbiAgICAnZGlzYWJsZWQnLFxuICAgICdmb3Jtbm92YWxpZGF0ZScsXG4gICAgJ2hpZGRlbicsXG4gICAgJ2lzbWFwJyxcbiAgICAnbG9vcCcsXG4gICAgJ211bHRpcGxlJyxcbiAgICAnbXV0ZWQnLFxuICAgICdub21vZHVsZScsXG4gICAgJ25vdmFsaWRhdGUnLFxuICAgICdvcGVuJyxcbiAgICAncGxheXNpbmxpbmUnLFxuICAgICdyZWFkb25seScsXG4gICAgJ3JlcXVpcmVkJyxcbiAgICAncmV2ZXJzZWQnLFxuICAgICdzZWxlY3RlZCdcbl0pO1xuXG5jb25zdCBpbnZhbGlkX2F0dHJpYnV0ZV9uYW1lX2NoYXJhY3RlciA9IC9bXFxzJ1wiPi89XFx1e0ZERDB9LVxcdXtGREVGfVxcdXtGRkZFfVxcdXtGRkZGfVxcdXsxRkZGRX1cXHV7MUZGRkZ9XFx1ezJGRkZFfVxcdXsyRkZGRn1cXHV7M0ZGRkV9XFx1ezNGRkZGfVxcdXs0RkZGRX1cXHV7NEZGRkZ9XFx1ezVGRkZFfVxcdXs1RkZGRn1cXHV7NkZGRkV9XFx1ezZGRkZGfVxcdXs3RkZGRX1cXHV7N0ZGRkZ9XFx1ezhGRkZFfVxcdXs4RkZGRn1cXHV7OUZGRkV9XFx1ezlGRkZGfVxcdXtBRkZGRX1cXHV7QUZGRkZ9XFx1e0JGRkZFfVxcdXtCRkZGRn1cXHV7Q0ZGRkV9XFx1e0NGRkZGfVxcdXtERkZGRX1cXHV7REZGRkZ9XFx1e0VGRkZFfVxcdXtFRkZGRn1cXHV7RkZGRkV9XFx1e0ZGRkZGfVxcdXsxMEZGRkV9XFx1ezEwRkZGRn1dL3U7XG4vLyBodHRwczovL2h0bWwuc3BlYy53aGF0d2cub3JnL211bHRpcGFnZS9zeW50YXguaHRtbCNhdHRyaWJ1dGVzLTJcbi8vIGh0dHBzOi8vaW5mcmEuc3BlYy53aGF0d2cub3JnLyNub25jaGFyYWN0ZXJcbmZ1bmN0aW9uIHNwcmVhZChhcmdzLCBjbGFzc2VzX3RvX2FkZCkge1xuICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBPYmplY3QuYXNzaWduKHt9LCAuLi5hcmdzKTtcbiAgICBpZiAoY2xhc3Nlc190b19hZGQpIHtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZXMuY2xhc3MgPT0gbnVsbCkge1xuICAgICAgICAgICAgYXR0cmlidXRlcy5jbGFzcyA9IGNsYXNzZXNfdG9fYWRkO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgYXR0cmlidXRlcy5jbGFzcyArPSAnICcgKyBjbGFzc2VzX3RvX2FkZDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBsZXQgc3RyID0gJyc7XG4gICAgT2JqZWN0LmtleXMoYXR0cmlidXRlcykuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgICAgaWYgKGludmFsaWRfYXR0cmlidXRlX25hbWVfY2hhcmFjdGVyLnRlc3QobmFtZSkpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IHZhbHVlID0gYXR0cmlidXRlc1tuYW1lXTtcbiAgICAgICAgaWYgKHZhbHVlID09PSB0cnVlKVxuICAgICAgICAgICAgc3RyICs9ICcgJyArIG5hbWU7XG4gICAgICAgIGVsc2UgaWYgKGJvb2xlYW5fYXR0cmlidXRlcy5oYXMobmFtZS50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlKVxuICAgICAgICAgICAgICAgIHN0ciArPSAnICcgKyBuYW1lO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgIHN0ciArPSBgICR7bmFtZX09XCIke3ZhbHVlfVwiYDtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBzdHI7XG59XG5jb25zdCBlc2NhcGVkID0ge1xuICAgICdcIic6ICcmcXVvdDsnLFxuICAgIFwiJ1wiOiAnJiMzOTsnLFxuICAgICcmJzogJyZhbXA7JyxcbiAgICAnPCc6ICcmbHQ7JyxcbiAgICAnPic6ICcmZ3Q7J1xufTtcbmZ1bmN0aW9uIGVzY2FwZShodG1sKSB7XG4gICAgcmV0dXJuIFN0cmluZyhodG1sKS5yZXBsYWNlKC9bXCInJjw+XS9nLCBtYXRjaCA9PiBlc2NhcGVkW21hdGNoXSk7XG59XG5mdW5jdGlvbiBlc2NhcGVfYXR0cmlidXRlX3ZhbHVlKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyBlc2NhcGUodmFsdWUpIDogdmFsdWU7XG59XG5mdW5jdGlvbiBlc2NhcGVfb2JqZWN0KG9iaikge1xuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgIGZvciAoY29uc3Qga2V5IGluIG9iaikge1xuICAgICAgICByZXN1bHRba2V5XSA9IGVzY2FwZV9hdHRyaWJ1dGVfdmFsdWUob2JqW2tleV0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuZnVuY3Rpb24gZWFjaChpdGVtcywgZm4pIHtcbiAgICBsZXQgc3RyID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICBzdHIgKz0gZm4oaXRlbXNbaV0sIGkpO1xuICAgIH1cbiAgICByZXR1cm4gc3RyO1xufVxuY29uc3QgbWlzc2luZ19jb21wb25lbnQgPSB7XG4gICAgJCRyZW5kZXI6ICgpID0+ICcnXG59O1xuZnVuY3Rpb24gdmFsaWRhdGVfY29tcG9uZW50KGNvbXBvbmVudCwgbmFtZSkge1xuICAgIGlmICghY29tcG9uZW50IHx8ICFjb21wb25lbnQuJCRyZW5kZXIpIHtcbiAgICAgICAgaWYgKG5hbWUgPT09ICdzdmVsdGU6Y29tcG9uZW50JylcbiAgICAgICAgICAgIG5hbWUgKz0gJyB0aGlzPXsuLi59JztcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGA8JHtuYW1lfT4gaXMgbm90IGEgdmFsaWQgU1NSIGNvbXBvbmVudC4gWW91IG1heSBuZWVkIHRvIHJldmlldyB5b3VyIGJ1aWxkIGNvbmZpZyB0byBlbnN1cmUgdGhhdCBkZXBlbmRlbmNpZXMgYXJlIGNvbXBpbGVkLCByYXRoZXIgdGhhbiBpbXBvcnRlZCBhcyBwcmUtY29tcGlsZWQgbW9kdWxlc2ApO1xuICAgIH1cbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZnVuY3Rpb24gZGVidWcoZmlsZSwgbGluZSwgY29sdW1uLCB2YWx1ZXMpIHtcbiAgICBjb25zb2xlLmxvZyhge0BkZWJ1Z30gJHtmaWxlID8gZmlsZSArICcgJyA6ICcnfSgke2xpbmV9OiR7Y29sdW1ufSlgKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1jb25zb2xlXG4gICAgY29uc29sZS5sb2codmFsdWVzKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1jb25zb2xlXG4gICAgcmV0dXJuICcnO1xufVxubGV0IG9uX2Rlc3Ryb3k7XG5mdW5jdGlvbiBjcmVhdGVfc3NyX2NvbXBvbmVudChmbikge1xuICAgIGZ1bmN0aW9uICQkcmVuZGVyKHJlc3VsdCwgcHJvcHMsIGJpbmRpbmdzLCBzbG90cywgY29udGV4dCkge1xuICAgICAgICBjb25zdCBwYXJlbnRfY29tcG9uZW50ID0gY3VycmVudF9jb21wb25lbnQ7XG4gICAgICAgIGNvbnN0ICQkID0ge1xuICAgICAgICAgICAgb25fZGVzdHJveSxcbiAgICAgICAgICAgIGNvbnRleHQ6IG5ldyBNYXAoY29udGV4dCB8fCAocGFyZW50X2NvbXBvbmVudCA/IHBhcmVudF9jb21wb25lbnQuJCQuY29udGV4dCA6IFtdKSksXG4gICAgICAgICAgICAvLyB0aGVzZSB3aWxsIGJlIGltbWVkaWF0ZWx5IGRpc2NhcmRlZFxuICAgICAgICAgICAgb25fbW91bnQ6IFtdLFxuICAgICAgICAgICAgYmVmb3JlX3VwZGF0ZTogW10sXG4gICAgICAgICAgICBhZnRlcl91cGRhdGU6IFtdLFxuICAgICAgICAgICAgY2FsbGJhY2tzOiBibGFua19vYmplY3QoKVxuICAgICAgICB9O1xuICAgICAgICBzZXRfY3VycmVudF9jb21wb25lbnQoeyAkJCB9KTtcbiAgICAgICAgY29uc3QgaHRtbCA9IGZuKHJlc3VsdCwgcHJvcHMsIGJpbmRpbmdzLCBzbG90cyk7XG4gICAgICAgIHNldF9jdXJyZW50X2NvbXBvbmVudChwYXJlbnRfY29tcG9uZW50KTtcbiAgICAgICAgcmV0dXJuIGh0bWw7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIHJlbmRlcjogKHByb3BzID0ge30sIHsgJCRzbG90cyA9IHt9LCBjb250ZXh0ID0gbmV3IE1hcCgpIH0gPSB7fSkgPT4ge1xuICAgICAgICAgICAgb25fZGVzdHJveSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0geyB0aXRsZTogJycsIGhlYWQ6ICcnLCBjc3M6IG5ldyBTZXQoKSB9O1xuICAgICAgICAgICAgY29uc3QgaHRtbCA9ICQkcmVuZGVyKHJlc3VsdCwgcHJvcHMsIHt9LCAkJHNsb3RzLCBjb250ZXh0KTtcbiAgICAgICAgICAgIHJ1bl9hbGwob25fZGVzdHJveSk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGh0bWwsXG4gICAgICAgICAgICAgICAgY3NzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IEFycmF5LmZyb20ocmVzdWx0LmNzcykubWFwKGNzcyA9PiBjc3MuY29kZSkuam9pbignXFxuJyksXG4gICAgICAgICAgICAgICAgICAgIG1hcDogbnVsbCAvLyBUT0RPXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBoZWFkOiByZXN1bHQudGl0bGUgKyByZXN1bHQuaGVhZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgJCRyZW5kZXJcbiAgICB9O1xufVxuZnVuY3Rpb24gYWRkX2F0dHJpYnV0ZShuYW1lLCB2YWx1ZSwgYm9vbGVhbikge1xuICAgIGlmICh2YWx1ZSA9PSBudWxsIHx8IChib29sZWFuICYmICF2YWx1ZSkpXG4gICAgICAgIHJldHVybiAnJztcbiAgICByZXR1cm4gYCAke25hbWV9JHt2YWx1ZSA9PT0gdHJ1ZSA/ICcnIDogYD0ke3R5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyBKU09OLnN0cmluZ2lmeShlc2NhcGUodmFsdWUpKSA6IGBcIiR7dmFsdWV9XCJgfWB9YDtcbn1cbmZ1bmN0aW9uIGFkZF9jbGFzc2VzKGNsYXNzZXMpIHtcbiAgICByZXR1cm4gY2xhc3NlcyA/IGAgY2xhc3M9XCIke2NsYXNzZXN9XCJgIDogJyc7XG59XG5cbmZ1bmN0aW9uIGJpbmQoY29tcG9uZW50LCBuYW1lLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IGluZGV4ID0gY29tcG9uZW50LiQkLnByb3BzW25hbWVdO1xuICAgIGlmIChpbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbXBvbmVudC4kJC5ib3VuZFtpbmRleF0gPSBjYWxsYmFjaztcbiAgICAgICAgY2FsbGJhY2soY29tcG9uZW50LiQkLmN0eFtpbmRleF0pO1xuICAgIH1cbn1cbmZ1bmN0aW9uIGNyZWF0ZV9jb21wb25lbnQoYmxvY2spIHtcbiAgICBibG9jayAmJiBibG9jay5jKCk7XG59XG5mdW5jdGlvbiBjbGFpbV9jb21wb25lbnQoYmxvY2ssIHBhcmVudF9ub2Rlcykge1xuICAgIGJsb2NrICYmIGJsb2NrLmwocGFyZW50X25vZGVzKTtcbn1cbmZ1bmN0aW9uIG1vdW50X2NvbXBvbmVudChjb21wb25lbnQsIHRhcmdldCwgYW5jaG9yLCBjdXN0b21FbGVtZW50KSB7XG4gICAgY29uc3QgeyBmcmFnbWVudCwgb25fbW91bnQsIG9uX2Rlc3Ryb3ksIGFmdGVyX3VwZGF0ZSB9ID0gY29tcG9uZW50LiQkO1xuICAgIGZyYWdtZW50ICYmIGZyYWdtZW50Lm0odGFyZ2V0LCBhbmNob3IpO1xuICAgIGlmICghY3VzdG9tRWxlbWVudCkge1xuICAgICAgICAvLyBvbk1vdW50IGhhcHBlbnMgYmVmb3JlIHRoZSBpbml0aWFsIGFmdGVyVXBkYXRlXG4gICAgICAgIGFkZF9yZW5kZXJfY2FsbGJhY2soKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbmV3X29uX2Rlc3Ryb3kgPSBvbl9tb3VudC5tYXAocnVuKS5maWx0ZXIoaXNfZnVuY3Rpb24pO1xuICAgICAgICAgICAgaWYgKG9uX2Rlc3Ryb3kpIHtcbiAgICAgICAgICAgICAgICBvbl9kZXN0cm95LnB1c2goLi4ubmV3X29uX2Rlc3Ryb3kpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gRWRnZSBjYXNlIC0gY29tcG9uZW50IHdhcyBkZXN0cm95ZWQgaW1tZWRpYXRlbHksXG4gICAgICAgICAgICAgICAgLy8gbW9zdCBsaWtlbHkgYXMgYSByZXN1bHQgb2YgYSBiaW5kaW5nIGluaXRpYWxpc2luZ1xuICAgICAgICAgICAgICAgIHJ1bl9hbGwobmV3X29uX2Rlc3Ryb3kpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29tcG9uZW50LiQkLm9uX21vdW50ID0gW107XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBhZnRlcl91cGRhdGUuZm9yRWFjaChhZGRfcmVuZGVyX2NhbGxiYWNrKTtcbn1cbmZ1bmN0aW9uIGRlc3Ryb3lfY29tcG9uZW50KGNvbXBvbmVudCwgZGV0YWNoaW5nKSB7XG4gICAgY29uc3QgJCQgPSBjb21wb25lbnQuJCQ7XG4gICAgaWYgKCQkLmZyYWdtZW50ICE9PSBudWxsKSB7XG4gICAgICAgIHJ1bl9hbGwoJCQub25fZGVzdHJveSk7XG4gICAgICAgICQkLmZyYWdtZW50ICYmICQkLmZyYWdtZW50LmQoZGV0YWNoaW5nKTtcbiAgICAgICAgLy8gVE9ETyBudWxsIG91dCBvdGhlciByZWZzLCBpbmNsdWRpbmcgY29tcG9uZW50LiQkIChidXQgbmVlZCB0b1xuICAgICAgICAvLyBwcmVzZXJ2ZSBmaW5hbCBzdGF0ZT8pXG4gICAgICAgICQkLm9uX2Rlc3Ryb3kgPSAkJC5mcmFnbWVudCA9IG51bGw7XG4gICAgICAgICQkLmN0eCA9IFtdO1xuICAgIH1cbn1cbmZ1bmN0aW9uIG1ha2VfZGlydHkoY29tcG9uZW50LCBpKSB7XG4gICAgaWYgKGNvbXBvbmVudC4kJC5kaXJ0eVswXSA9PT0gLTEpIHtcbiAgICAgICAgZGlydHlfY29tcG9uZW50cy5wdXNoKGNvbXBvbmVudCk7XG4gICAgICAgIHNjaGVkdWxlX3VwZGF0ZSgpO1xuICAgICAgICBjb21wb25lbnQuJCQuZGlydHkuZmlsbCgwKTtcbiAgICB9XG4gICAgY29tcG9uZW50LiQkLmRpcnR5WyhpIC8gMzEpIHwgMF0gfD0gKDEgPDwgKGkgJSAzMSkpO1xufVxuZnVuY3Rpb24gaW5pdChjb21wb25lbnQsIG9wdGlvbnMsIGluc3RhbmNlLCBjcmVhdGVfZnJhZ21lbnQsIG5vdF9lcXVhbCwgcHJvcHMsIGFwcGVuZF9zdHlsZXMsIGRpcnR5ID0gWy0xXSkge1xuICAgIGNvbnN0IHBhcmVudF9jb21wb25lbnQgPSBjdXJyZW50X2NvbXBvbmVudDtcbiAgICBzZXRfY3VycmVudF9jb21wb25lbnQoY29tcG9uZW50KTtcbiAgICBjb25zdCAkJCA9IGNvbXBvbmVudC4kJCA9IHtcbiAgICAgICAgZnJhZ21lbnQ6IG51bGwsXG4gICAgICAgIGN0eDogbnVsbCxcbiAgICAgICAgLy8gc3RhdGVcbiAgICAgICAgcHJvcHMsXG4gICAgICAgIHVwZGF0ZTogbm9vcCxcbiAgICAgICAgbm90X2VxdWFsLFxuICAgICAgICBib3VuZDogYmxhbmtfb2JqZWN0KCksXG4gICAgICAgIC8vIGxpZmVjeWNsZVxuICAgICAgICBvbl9tb3VudDogW10sXG4gICAgICAgIG9uX2Rlc3Ryb3k6IFtdLFxuICAgICAgICBvbl9kaXNjb25uZWN0OiBbXSxcbiAgICAgICAgYmVmb3JlX3VwZGF0ZTogW10sXG4gICAgICAgIGFmdGVyX3VwZGF0ZTogW10sXG4gICAgICAgIGNvbnRleHQ6IG5ldyBNYXAob3B0aW9ucy5jb250ZXh0IHx8IChwYXJlbnRfY29tcG9uZW50ID8gcGFyZW50X2NvbXBvbmVudC4kJC5jb250ZXh0IDogW10pKSxcbiAgICAgICAgLy8gZXZlcnl0aGluZyBlbHNlXG4gICAgICAgIGNhbGxiYWNrczogYmxhbmtfb2JqZWN0KCksXG4gICAgICAgIGRpcnR5LFxuICAgICAgICBza2lwX2JvdW5kOiBmYWxzZSxcbiAgICAgICAgcm9vdDogb3B0aW9ucy50YXJnZXQgfHwgcGFyZW50X2NvbXBvbmVudC4kJC5yb290XG4gICAgfTtcbiAgICBhcHBlbmRfc3R5bGVzICYmIGFwcGVuZF9zdHlsZXMoJCQucm9vdCk7XG4gICAgbGV0IHJlYWR5ID0gZmFsc2U7XG4gICAgJCQuY3R4ID0gaW5zdGFuY2VcbiAgICAgICAgPyBpbnN0YW5jZShjb21wb25lbnQsIG9wdGlvbnMucHJvcHMgfHwge30sIChpLCByZXQsIC4uLnJlc3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gcmVzdC5sZW5ndGggPyByZXN0WzBdIDogcmV0O1xuICAgICAgICAgICAgaWYgKCQkLmN0eCAmJiBub3RfZXF1YWwoJCQuY3R4W2ldLCAkJC5jdHhbaV0gPSB2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoISQkLnNraXBfYm91bmQgJiYgJCQuYm91bmRbaV0pXG4gICAgICAgICAgICAgICAgICAgICQkLmJvdW5kW2ldKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAocmVhZHkpXG4gICAgICAgICAgICAgICAgICAgIG1ha2VfZGlydHkoY29tcG9uZW50LCBpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXQ7XG4gICAgICAgIH0pXG4gICAgICAgIDogW107XG4gICAgJCQudXBkYXRlKCk7XG4gICAgcmVhZHkgPSB0cnVlO1xuICAgIHJ1bl9hbGwoJCQuYmVmb3JlX3VwZGF0ZSk7XG4gICAgLy8gYGZhbHNlYCBhcyBhIHNwZWNpYWwgY2FzZSBvZiBubyBET00gY29tcG9uZW50XG4gICAgJCQuZnJhZ21lbnQgPSBjcmVhdGVfZnJhZ21lbnQgPyBjcmVhdGVfZnJhZ21lbnQoJCQuY3R4KSA6IGZhbHNlO1xuICAgIGlmIChvcHRpb25zLnRhcmdldCkge1xuICAgICAgICBpZiAob3B0aW9ucy5oeWRyYXRlKSB7XG4gICAgICAgICAgICBzdGFydF9oeWRyYXRpbmcoKTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVzID0gY2hpbGRyZW4ob3B0aW9ucy50YXJnZXQpO1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICAgICQkLmZyYWdtZW50ICYmICQkLmZyYWdtZW50Lmwobm9kZXMpO1xuICAgICAgICAgICAgbm9kZXMuZm9yRWFjaChkZXRhY2gpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgICAgICAgICQkLmZyYWdtZW50ICYmICQkLmZyYWdtZW50LmMoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5pbnRybylcbiAgICAgICAgICAgIHRyYW5zaXRpb25faW4oY29tcG9uZW50LiQkLmZyYWdtZW50KTtcbiAgICAgICAgbW91bnRfY29tcG9uZW50KGNvbXBvbmVudCwgb3B0aW9ucy50YXJnZXQsIG9wdGlvbnMuYW5jaG9yLCBvcHRpb25zLmN1c3RvbUVsZW1lbnQpO1xuICAgICAgICBlbmRfaHlkcmF0aW5nKCk7XG4gICAgICAgIGZsdXNoKCk7XG4gICAgfVxuICAgIHNldF9jdXJyZW50X2NvbXBvbmVudChwYXJlbnRfY29tcG9uZW50KTtcbn1cbmxldCBTdmVsdGVFbGVtZW50O1xuaWYgKHR5cGVvZiBIVE1MRWxlbWVudCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIFN2ZWx0ZUVsZW1lbnQgPSBjbGFzcyBleHRlbmRzIEhUTUxFbGVtZW50IHtcbiAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICBzdXBlcigpO1xuICAgICAgICAgICAgdGhpcy5hdHRhY2hTaGFkb3coeyBtb2RlOiAnb3BlbicgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgICAgICBjb25zdCB7IG9uX21vdW50IH0gPSB0aGlzLiQkO1xuICAgICAgICAgICAgdGhpcy4kJC5vbl9kaXNjb25uZWN0ID0gb25fbW91bnQubWFwKHJ1bikuZmlsdGVyKGlzX2Z1bmN0aW9uKTtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmUgdG9kbzogaW1wcm92ZSB0eXBpbmdzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLiQkLnNsb3R0ZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlIHRvZG86IGltcHJvdmUgdHlwaW5nc1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kQ2hpbGQodGhpcy4kJC5zbG90dGVkW2tleV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyLCBfb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzW2F0dHJdID0gbmV3VmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgICAgICBydW5fYWxsKHRoaXMuJCQub25fZGlzY29ubmVjdCk7XG4gICAgICAgIH1cbiAgICAgICAgJGRlc3Ryb3koKSB7XG4gICAgICAgICAgICBkZXN0cm95X2NvbXBvbmVudCh0aGlzLCAxKTtcbiAgICAgICAgICAgIHRoaXMuJGRlc3Ryb3kgPSBub29wO1xuICAgICAgICB9XG4gICAgICAgICRvbih0eXBlLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgLy8gVE9ETyBzaG91bGQgdGhpcyBkZWxlZ2F0ZSB0byBhZGRFdmVudExpc3RlbmVyP1xuICAgICAgICAgICAgY29uc3QgY2FsbGJhY2tzID0gKHRoaXMuJCQuY2FsbGJhY2tzW3R5cGVdIHx8ICh0aGlzLiQkLmNhbGxiYWNrc1t0eXBlXSA9IFtdKSk7XG4gICAgICAgICAgICBjYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gY2FsbGJhY2tzLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICAkc2V0KCQkcHJvcHMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLiQkc2V0ICYmICFpc19lbXB0eSgkJHByb3BzKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuJCQuc2tpcF9ib3VuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy4kJHNldCgkJHByb3BzKTtcbiAgICAgICAgICAgICAgICB0aGlzLiQkLnNraXBfYm91bmQgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG59XG4vKipcbiAqIEJhc2UgY2xhc3MgZm9yIFN2ZWx0ZSBjb21wb25lbnRzLiBVc2VkIHdoZW4gZGV2PWZhbHNlLlxuICovXG5jbGFzcyBTdmVsdGVDb21wb25lbnQge1xuICAgICRkZXN0cm95KCkge1xuICAgICAgICBkZXN0cm95X2NvbXBvbmVudCh0aGlzLCAxKTtcbiAgICAgICAgdGhpcy4kZGVzdHJveSA9IG5vb3A7XG4gICAgfVxuICAgICRvbih0eXBlLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBjYWxsYmFja3MgPSAodGhpcy4kJC5jYWxsYmFja3NbdHlwZV0gfHwgKHRoaXMuJCQuY2FsbGJhY2tzW3R5cGVdID0gW10pKTtcbiAgICAgICAgY2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBjYWxsYmFja3MuaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9O1xuICAgIH1cbiAgICAkc2V0KCQkcHJvcHMpIHtcbiAgICAgICAgaWYgKHRoaXMuJCRzZXQgJiYgIWlzX2VtcHR5KCQkcHJvcHMpKSB7XG4gICAgICAgICAgICB0aGlzLiQkLnNraXBfYm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy4kJHNldCgkJHByb3BzKTtcbiAgICAgICAgICAgIHRoaXMuJCQuc2tpcF9ib3VuZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkaXNwYXRjaF9kZXYodHlwZSwgZGV0YWlsKSB7XG4gICAgZG9jdW1lbnQuZGlzcGF0Y2hFdmVudChjdXN0b21fZXZlbnQodHlwZSwgT2JqZWN0LmFzc2lnbih7IHZlcnNpb246ICczLjQ0LjInIH0sIGRldGFpbCksIHRydWUpKTtcbn1cbmZ1bmN0aW9uIGFwcGVuZF9kZXYodGFyZ2V0LCBub2RlKSB7XG4gICAgZGlzcGF0Y2hfZGV2KCdTdmVsdGVET01JbnNlcnQnLCB7IHRhcmdldCwgbm9kZSB9KTtcbiAgICBhcHBlbmQodGFyZ2V0LCBub2RlKTtcbn1cbmZ1bmN0aW9uIGFwcGVuZF9oeWRyYXRpb25fZGV2KHRhcmdldCwgbm9kZSkge1xuICAgIGRpc3BhdGNoX2RldignU3ZlbHRlRE9NSW5zZXJ0JywgeyB0YXJnZXQsIG5vZGUgfSk7XG4gICAgYXBwZW5kX2h5ZHJhdGlvbih0YXJnZXQsIG5vZGUpO1xufVxuZnVuY3Rpb24gaW5zZXJ0X2Rldih0YXJnZXQsIG5vZGUsIGFuY2hvcikge1xuICAgIGRpc3BhdGNoX2RldignU3ZlbHRlRE9NSW5zZXJ0JywgeyB0YXJnZXQsIG5vZGUsIGFuY2hvciB9KTtcbiAgICBpbnNlcnQodGFyZ2V0LCBub2RlLCBhbmNob3IpO1xufVxuZnVuY3Rpb24gaW5zZXJ0X2h5ZHJhdGlvbl9kZXYodGFyZ2V0LCBub2RlLCBhbmNob3IpIHtcbiAgICBkaXNwYXRjaF9kZXYoJ1N2ZWx0ZURPTUluc2VydCcsIHsgdGFyZ2V0LCBub2RlLCBhbmNob3IgfSk7XG4gICAgaW5zZXJ0X2h5ZHJhdGlvbih0YXJnZXQsIG5vZGUsIGFuY2hvcik7XG59XG5mdW5jdGlvbiBkZXRhY2hfZGV2KG5vZGUpIHtcbiAgICBkaXNwYXRjaF9kZXYoJ1N2ZWx0ZURPTVJlbW92ZScsIHsgbm9kZSB9KTtcbiAgICBkZXRhY2gobm9kZSk7XG59XG5mdW5jdGlvbiBkZXRhY2hfYmV0d2Vlbl9kZXYoYmVmb3JlLCBhZnRlcikge1xuICAgIHdoaWxlIChiZWZvcmUubmV4dFNpYmxpbmcgJiYgYmVmb3JlLm5leHRTaWJsaW5nICE9PSBhZnRlcikge1xuICAgICAgICBkZXRhY2hfZGV2KGJlZm9yZS5uZXh0U2libGluZyk7XG4gICAgfVxufVxuZnVuY3Rpb24gZGV0YWNoX2JlZm9yZV9kZXYoYWZ0ZXIpIHtcbiAgICB3aGlsZSAoYWZ0ZXIucHJldmlvdXNTaWJsaW5nKSB7XG4gICAgICAgIGRldGFjaF9kZXYoYWZ0ZXIucHJldmlvdXNTaWJsaW5nKTtcbiAgICB9XG59XG5mdW5jdGlvbiBkZXRhY2hfYWZ0ZXJfZGV2KGJlZm9yZSkge1xuICAgIHdoaWxlIChiZWZvcmUubmV4dFNpYmxpbmcpIHtcbiAgICAgICAgZGV0YWNoX2RldihiZWZvcmUubmV4dFNpYmxpbmcpO1xuICAgIH1cbn1cbmZ1bmN0aW9uIGxpc3Rlbl9kZXYobm9kZSwgZXZlbnQsIGhhbmRsZXIsIG9wdGlvbnMsIGhhc19wcmV2ZW50X2RlZmF1bHQsIGhhc19zdG9wX3Byb3BhZ2F0aW9uKSB7XG4gICAgY29uc3QgbW9kaWZpZXJzID0gb3B0aW9ucyA9PT0gdHJ1ZSA/IFsnY2FwdHVyZSddIDogb3B0aW9ucyA/IEFycmF5LmZyb20oT2JqZWN0LmtleXMob3B0aW9ucykpIDogW107XG4gICAgaWYgKGhhc19wcmV2ZW50X2RlZmF1bHQpXG4gICAgICAgIG1vZGlmaWVycy5wdXNoKCdwcmV2ZW50RGVmYXVsdCcpO1xuICAgIGlmIChoYXNfc3RvcF9wcm9wYWdhdGlvbilcbiAgICAgICAgbW9kaWZpZXJzLnB1c2goJ3N0b3BQcm9wYWdhdGlvbicpO1xuICAgIGRpc3BhdGNoX2RldignU3ZlbHRlRE9NQWRkRXZlbnRMaXN0ZW5lcicsIHsgbm9kZSwgZXZlbnQsIGhhbmRsZXIsIG1vZGlmaWVycyB9KTtcbiAgICBjb25zdCBkaXNwb3NlID0gbGlzdGVuKG5vZGUsIGV2ZW50LCBoYW5kbGVyLCBvcHRpb25zKTtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICBkaXNwYXRjaF9kZXYoJ1N2ZWx0ZURPTVJlbW92ZUV2ZW50TGlzdGVuZXInLCB7IG5vZGUsIGV2ZW50LCBoYW5kbGVyLCBtb2RpZmllcnMgfSk7XG4gICAgICAgIGRpc3Bvc2UoKTtcbiAgICB9O1xufVxuZnVuY3Rpb24gYXR0cl9kZXYobm9kZSwgYXR0cmlidXRlLCB2YWx1ZSkge1xuICAgIGF0dHIobm9kZSwgYXR0cmlidXRlLCB2YWx1ZSk7XG4gICAgaWYgKHZhbHVlID09IG51bGwpXG4gICAgICAgIGRpc3BhdGNoX2RldignU3ZlbHRlRE9NUmVtb3ZlQXR0cmlidXRlJywgeyBub2RlLCBhdHRyaWJ1dGUgfSk7XG4gICAgZWxzZVxuICAgICAgICBkaXNwYXRjaF9kZXYoJ1N2ZWx0ZURPTVNldEF0dHJpYnV0ZScsIHsgbm9kZSwgYXR0cmlidXRlLCB2YWx1ZSB9KTtcbn1cbmZ1bmN0aW9uIHByb3BfZGV2KG5vZGUsIHByb3BlcnR5LCB2YWx1ZSkge1xuICAgIG5vZGVbcHJvcGVydHldID0gdmFsdWU7XG4gICAgZGlzcGF0Y2hfZGV2KCdTdmVsdGVET01TZXRQcm9wZXJ0eScsIHsgbm9kZSwgcHJvcGVydHksIHZhbHVlIH0pO1xufVxuZnVuY3Rpb24gZGF0YXNldF9kZXYobm9kZSwgcHJvcGVydHksIHZhbHVlKSB7XG4gICAgbm9kZS5kYXRhc2V0W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgIGRpc3BhdGNoX2RldignU3ZlbHRlRE9NU2V0RGF0YXNldCcsIHsgbm9kZSwgcHJvcGVydHksIHZhbHVlIH0pO1xufVxuZnVuY3Rpb24gc2V0X2RhdGFfZGV2KHRleHQsIGRhdGEpIHtcbiAgICBkYXRhID0gJycgKyBkYXRhO1xuICAgIGlmICh0ZXh0Lndob2xlVGV4dCA9PT0gZGF0YSlcbiAgICAgICAgcmV0dXJuO1xuICAgIGRpc3BhdGNoX2RldignU3ZlbHRlRE9NU2V0RGF0YScsIHsgbm9kZTogdGV4dCwgZGF0YSB9KTtcbiAgICB0ZXh0LmRhdGEgPSBkYXRhO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVfZWFjaF9hcmd1bWVudChhcmcpIHtcbiAgICBpZiAodHlwZW9mIGFyZyAhPT0gJ3N0cmluZycgJiYgIShhcmcgJiYgdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgJ2xlbmd0aCcgaW4gYXJnKSkge1xuICAgICAgICBsZXQgbXNnID0gJ3sjZWFjaH0gb25seSBpdGVyYXRlcyBvdmVyIGFycmF5LWxpa2Ugb2JqZWN0cy4nO1xuICAgICAgICBpZiAodHlwZW9mIFN5bWJvbCA9PT0gJ2Z1bmN0aW9uJyAmJiBhcmcgJiYgU3ltYm9sLml0ZXJhdG9yIGluIGFyZykge1xuICAgICAgICAgICAgbXNnICs9ICcgWW91IGNhbiB1c2UgYSBzcHJlYWQgdG8gY29udmVydCB0aGlzIGl0ZXJhYmxlIGludG8gYW4gYXJyYXkuJztcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobXNnKTtcbiAgICB9XG59XG5mdW5jdGlvbiB2YWxpZGF0ZV9zbG90cyhuYW1lLCBzbG90LCBrZXlzKSB7XG4gICAgZm9yIChjb25zdCBzbG90X2tleSBvZiBPYmplY3Qua2V5cyhzbG90KSkge1xuICAgICAgICBpZiAoIX5rZXlzLmluZGV4T2Yoc2xvdF9rZXkpKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYDwke25hbWV9PiByZWNlaXZlZCBhbiB1bmV4cGVjdGVkIHNsb3QgXCIke3Nsb3Rfa2V5fVwiLmApO1xuICAgICAgICB9XG4gICAgfVxufVxuLyoqXG4gKiBCYXNlIGNsYXNzIGZvciBTdmVsdGUgY29tcG9uZW50cyB3aXRoIHNvbWUgbWlub3IgZGV2LWVuaGFuY2VtZW50cy4gVXNlZCB3aGVuIGRldj10cnVlLlxuICovXG5jbGFzcyBTdmVsdGVDb21wb25lbnREZXYgZXh0ZW5kcyBTdmVsdGVDb21wb25lbnQge1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zIHx8ICghb3B0aW9ucy50YXJnZXQgJiYgIW9wdGlvbnMuJCRpbmxpbmUpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCIndGFyZ2V0JyBpcyBhIHJlcXVpcmVkIG9wdGlvblwiKTtcbiAgICAgICAgfVxuICAgICAgICBzdXBlcigpO1xuICAgIH1cbiAgICAkZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuJGRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy4kZGVzdHJveSA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignQ29tcG9uZW50IHdhcyBhbHJlYWR5IGRlc3Ryb3llZCcpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWNvbnNvbGVcbiAgICAgICAgfTtcbiAgICB9XG4gICAgJGNhcHR1cmVfc3RhdGUoKSB7IH1cbiAgICAkaW5qZWN0X3N0YXRlKCkgeyB9XG59XG4vKipcbiAqIEJhc2UgY2xhc3MgdG8gY3JlYXRlIHN0cm9uZ2x5IHR5cGVkIFN2ZWx0ZSBjb21wb25lbnRzLlxuICogVGhpcyBvbmx5IGV4aXN0cyBmb3IgdHlwaW5nIHB1cnBvc2VzIGFuZCBzaG91bGQgYmUgdXNlZCBpbiBgLmQudHNgIGZpbGVzLlxuICpcbiAqICMjIyBFeGFtcGxlOlxuICpcbiAqIFlvdSBoYXZlIGNvbXBvbmVudCBsaWJyYXJ5IG9uIG5wbSBjYWxsZWQgYGNvbXBvbmVudC1saWJyYXJ5YCwgZnJvbSB3aGljaFxuICogeW91IGV4cG9ydCBhIGNvbXBvbmVudCBjYWxsZWQgYE15Q29tcG9uZW50YC4gRm9yIFN2ZWx0ZStUeXBlU2NyaXB0IHVzZXJzLFxuICogeW91IHdhbnQgdG8gcHJvdmlkZSB0eXBpbmdzLiBUaGVyZWZvcmUgeW91IGNyZWF0ZSBhIGBpbmRleC5kLnRzYDpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBTdmVsdGVDb21wb25lbnRUeXBlZCB9IGZyb20gXCJzdmVsdGVcIjtcbiAqIGV4cG9ydCBjbGFzcyBNeUNvbXBvbmVudCBleHRlbmRzIFN2ZWx0ZUNvbXBvbmVudFR5cGVkPHtmb286IHN0cmluZ30+IHt9XG4gKiBgYGBcbiAqIFR5cGluZyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvciBJREVzIGxpa2UgVlMgQ29kZSB3aXRoIHRoZSBTdmVsdGUgZXh0ZW5zaW9uXG4gKiB0byBwcm92aWRlIGludGVsbGlzZW5zZSBhbmQgdG8gdXNlIHRoZSBjb21wb25lbnQgbGlrZSB0aGlzIGluIGEgU3ZlbHRlIGZpbGVcbiAqIHdpdGggVHlwZVNjcmlwdDpcbiAqIGBgYHN2ZWx0ZVxuICogPHNjcmlwdCBsYW5nPVwidHNcIj5cbiAqIFx0aW1wb3J0IHsgTXlDb21wb25lbnQgfSBmcm9tIFwiY29tcG9uZW50LWxpYnJhcnlcIjtcbiAqIDwvc2NyaXB0PlxuICogPE15Q29tcG9uZW50IGZvbz17J2Jhcid9IC8+XG4gKiBgYGBcbiAqXG4gKiAjIyMjIFdoeSBub3QgbWFrZSB0aGlzIHBhcnQgb2YgYFN2ZWx0ZUNvbXBvbmVudChEZXYpYD9cbiAqIEJlY2F1c2VcbiAqIGBgYHRzXG4gKiBjbGFzcyBBU3ViY2xhc3NPZlN2ZWx0ZUNvbXBvbmVudCBleHRlbmRzIFN2ZWx0ZUNvbXBvbmVudDx7Zm9vOiBzdHJpbmd9PiB7fVxuICogY29uc3QgY29tcG9uZW50OiB0eXBlb2YgU3ZlbHRlQ29tcG9uZW50ID0gQVN1YmNsYXNzT2ZTdmVsdGVDb21wb25lbnQ7XG4gKiBgYGBcbiAqIHdpbGwgdGhyb3cgYSB0eXBlIGVycm9yLCBzbyB3ZSBuZWVkIHRvIHNlcGFyYXRlIHRoZSBtb3JlIHN0cmljdGx5IHR5cGVkIGNsYXNzLlxuICovXG5jbGFzcyBTdmVsdGVDb21wb25lbnRUeXBlZCBleHRlbmRzIFN2ZWx0ZUNvbXBvbmVudERldiB7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcbiAgICB9XG59XG5mdW5jdGlvbiBsb29wX2d1YXJkKHRpbWVvdXQpIHtcbiAgICBjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgaWYgKERhdGUubm93KCkgLSBzdGFydCA+IHRpbWVvdXQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW5maW5pdGUgbG9vcCBkZXRlY3RlZCcpO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuZXhwb3J0IHsgSHRtbFRhZywgSHRtbFRhZ0h5ZHJhdGlvbiwgU3ZlbHRlQ29tcG9uZW50LCBTdmVsdGVDb21wb25lbnREZXYsIFN2ZWx0ZUNvbXBvbmVudFR5cGVkLCBTdmVsdGVFbGVtZW50LCBhY3Rpb25fZGVzdHJveWVyLCBhZGRfYXR0cmlidXRlLCBhZGRfY2xhc3NlcywgYWRkX2ZsdXNoX2NhbGxiYWNrLCBhZGRfbG9jYXRpb24sIGFkZF9yZW5kZXJfY2FsbGJhY2ssIGFkZF9yZXNpemVfbGlzdGVuZXIsIGFkZF90cmFuc2Zvcm0sIGFmdGVyVXBkYXRlLCBhcHBlbmQsIGFwcGVuZF9kZXYsIGFwcGVuZF9lbXB0eV9zdHlsZXNoZWV0LCBhcHBlbmRfaHlkcmF0aW9uLCBhcHBlbmRfaHlkcmF0aW9uX2RldiwgYXBwZW5kX3N0eWxlcywgYXNzaWduLCBhdHRyLCBhdHRyX2RldiwgYXR0cmlidXRlX3RvX29iamVjdCwgYmVmb3JlVXBkYXRlLCBiaW5kLCBiaW5kaW5nX2NhbGxiYWNrcywgYmxhbmtfb2JqZWN0LCBidWJibGUsIGNoZWNrX291dHJvcywgY2hpbGRyZW4sIGNsYWltX2NvbXBvbmVudCwgY2xhaW1fZWxlbWVudCwgY2xhaW1faHRtbF90YWcsIGNsYWltX3NwYWNlLCBjbGFpbV9zdmdfZWxlbWVudCwgY2xhaW1fdGV4dCwgY2xlYXJfbG9vcHMsIGNvbXBvbmVudF9zdWJzY3JpYmUsIGNvbXB1dGVfcmVzdF9wcm9wcywgY29tcHV0ZV9zbG90cywgY3JlYXRlRXZlbnREaXNwYXRjaGVyLCBjcmVhdGVfYW5pbWF0aW9uLCBjcmVhdGVfYmlkaXJlY3Rpb25hbF90cmFuc2l0aW9uLCBjcmVhdGVfY29tcG9uZW50LCBjcmVhdGVfaW5fdHJhbnNpdGlvbiwgY3JlYXRlX291dF90cmFuc2l0aW9uLCBjcmVhdGVfc2xvdCwgY3JlYXRlX3Nzcl9jb21wb25lbnQsIGN1cnJlbnRfY29tcG9uZW50LCBjdXN0b21fZXZlbnQsIGRhdGFzZXRfZGV2LCBkZWJ1ZywgZGVzdHJveV9ibG9jaywgZGVzdHJveV9jb21wb25lbnQsIGRlc3Ryb3lfZWFjaCwgZGV0YWNoLCBkZXRhY2hfYWZ0ZXJfZGV2LCBkZXRhY2hfYmVmb3JlX2RldiwgZGV0YWNoX2JldHdlZW5fZGV2LCBkZXRhY2hfZGV2LCBkaXJ0eV9jb21wb25lbnRzLCBkaXNwYXRjaF9kZXYsIGVhY2gsIGVsZW1lbnQsIGVsZW1lbnRfaXMsIGVtcHR5LCBlbmRfaHlkcmF0aW5nLCBlc2NhcGUsIGVzY2FwZV9hdHRyaWJ1dGVfdmFsdWUsIGVzY2FwZV9vYmplY3QsIGVzY2FwZWQsIGV4Y2x1ZGVfaW50ZXJuYWxfcHJvcHMsIGZpeF9hbmRfZGVzdHJveV9ibG9jaywgZml4X2FuZF9vdXRyb19hbmRfZGVzdHJveV9ibG9jaywgZml4X3Bvc2l0aW9uLCBmbHVzaCwgZ2V0QWxsQ29udGV4dHMsIGdldENvbnRleHQsIGdldF9hbGxfZGlydHlfZnJvbV9zY29wZSwgZ2V0X2JpbmRpbmdfZ3JvdXBfdmFsdWUsIGdldF9jdXJyZW50X2NvbXBvbmVudCwgZ2V0X2N1c3RvbV9lbGVtZW50c19zbG90cywgZ2V0X3Jvb3RfZm9yX3N0eWxlLCBnZXRfc2xvdF9jaGFuZ2VzLCBnZXRfc3ByZWFkX29iamVjdCwgZ2V0X3NwcmVhZF91cGRhdGUsIGdldF9zdG9yZV92YWx1ZSwgZ2xvYmFscywgZ3JvdXBfb3V0cm9zLCBoYW5kbGVfcHJvbWlzZSwgaGFzQ29udGV4dCwgaGFzX3Byb3AsIGlkZW50aXR5LCBpbml0LCBpbnNlcnQsIGluc2VydF9kZXYsIGluc2VydF9oeWRyYXRpb24sIGluc2VydF9oeWRyYXRpb25fZGV2LCBpbnRyb3MsIGludmFsaWRfYXR0cmlidXRlX25hbWVfY2hhcmFjdGVyLCBpc19jbGllbnQsIGlzX2Nyb3Nzb3JpZ2luLCBpc19lbXB0eSwgaXNfZnVuY3Rpb24sIGlzX3Byb21pc2UsIGxpc3RlbiwgbGlzdGVuX2RldiwgbG9vcCwgbG9vcF9ndWFyZCwgbWlzc2luZ19jb21wb25lbnQsIG1vdW50X2NvbXBvbmVudCwgbm9vcCwgbm90X2VxdWFsLCBub3csIG51bGxfdG9fZW1wdHksIG9iamVjdF93aXRob3V0X3Byb3BlcnRpZXMsIG9uRGVzdHJveSwgb25Nb3VudCwgb25jZSwgb3V0cm9fYW5kX2Rlc3Ryb3lfYmxvY2ssIHByZXZlbnRfZGVmYXVsdCwgcHJvcF9kZXYsIHF1ZXJ5X3NlbGVjdG9yX2FsbCwgcmFmLCBydW4sIHJ1bl9hbGwsIHNhZmVfbm90X2VxdWFsLCBzY2hlZHVsZV91cGRhdGUsIHNlbGVjdF9tdWx0aXBsZV92YWx1ZSwgc2VsZWN0X29wdGlvbiwgc2VsZWN0X29wdGlvbnMsIHNlbGVjdF92YWx1ZSwgc2VsZiwgc2V0Q29udGV4dCwgc2V0X2F0dHJpYnV0ZXMsIHNldF9jdXJyZW50X2NvbXBvbmVudCwgc2V0X2N1c3RvbV9lbGVtZW50X2RhdGEsIHNldF9kYXRhLCBzZXRfZGF0YV9kZXYsIHNldF9pbnB1dF90eXBlLCBzZXRfaW5wdXRfdmFsdWUsIHNldF9ub3csIHNldF9yYWYsIHNldF9zdG9yZV92YWx1ZSwgc2V0X3N0eWxlLCBzZXRfc3ZnX2F0dHJpYnV0ZXMsIHNwYWNlLCBzcHJlYWQsIHNyY191cmxfZXF1YWwsIHN0YXJ0X2h5ZHJhdGluZywgc3RvcF9wcm9wYWdhdGlvbiwgc3Vic2NyaWJlLCBzdmdfZWxlbWVudCwgdGV4dCwgdGljaywgdGltZV9yYW5nZXNfdG9fYXJyYXksIHRvX251bWJlciwgdG9nZ2xlX2NsYXNzLCB0cmFuc2l0aW9uX2luLCB0cmFuc2l0aW9uX291dCwgdHJ1c3RlZCwgdXBkYXRlX2F3YWl0X2Jsb2NrX2JyYW5jaCwgdXBkYXRlX2tleWVkX2VhY2gsIHVwZGF0ZV9zbG90LCB1cGRhdGVfc2xvdF9iYXNlLCB2YWxpZGF0ZV9jb21wb25lbnQsIHZhbGlkYXRlX2VhY2hfYXJndW1lbnQsIHZhbGlkYXRlX2VhY2hfa2V5cywgdmFsaWRhdGVfc2xvdHMsIHZhbGlkYXRlX3N0b3JlLCB4bGlua19hdHRyIH07XG4iLCJpbXBvcnQgeyBub29wLCBzYWZlX25vdF9lcXVhbCwgc3Vic2NyaWJlLCBydW5fYWxsLCBpc19mdW5jdGlvbiB9IGZyb20gJy4uL2ludGVybmFsL2luZGV4Lm1qcyc7XG5leHBvcnQgeyBnZXRfc3RvcmVfdmFsdWUgYXMgZ2V0IH0gZnJvbSAnLi4vaW50ZXJuYWwvaW5kZXgubWpzJztcblxuY29uc3Qgc3Vic2NyaWJlcl9xdWV1ZSA9IFtdO1xuLyoqXG4gKiBDcmVhdGVzIGEgYFJlYWRhYmxlYCBzdG9yZSB0aGF0IGFsbG93cyByZWFkaW5nIGJ5IHN1YnNjcmlwdGlvbi5cbiAqIEBwYXJhbSB2YWx1ZSBpbml0aWFsIHZhbHVlXG4gKiBAcGFyYW0ge1N0YXJ0U3RvcE5vdGlmaWVyfXN0YXJ0IHN0YXJ0IGFuZCBzdG9wIG5vdGlmaWNhdGlvbnMgZm9yIHN1YnNjcmlwdGlvbnNcbiAqL1xuZnVuY3Rpb24gcmVhZGFibGUodmFsdWUsIHN0YXJ0KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgc3Vic2NyaWJlOiB3cml0YWJsZSh2YWx1ZSwgc3RhcnQpLnN1YnNjcmliZVxuICAgIH07XG59XG4vKipcbiAqIENyZWF0ZSBhIGBXcml0YWJsZWAgc3RvcmUgdGhhdCBhbGxvd3MgYm90aCB1cGRhdGluZyBhbmQgcmVhZGluZyBieSBzdWJzY3JpcHRpb24uXG4gKiBAcGFyYW0geyo9fXZhbHVlIGluaXRpYWwgdmFsdWVcbiAqIEBwYXJhbSB7U3RhcnRTdG9wTm90aWZpZXI9fXN0YXJ0IHN0YXJ0IGFuZCBzdG9wIG5vdGlmaWNhdGlvbnMgZm9yIHN1YnNjcmlwdGlvbnNcbiAqL1xuZnVuY3Rpb24gd3JpdGFibGUodmFsdWUsIHN0YXJ0ID0gbm9vcCkge1xuICAgIGxldCBzdG9wO1xuICAgIGNvbnN0IHN1YnNjcmliZXJzID0gbmV3IFNldCgpO1xuICAgIGZ1bmN0aW9uIHNldChuZXdfdmFsdWUpIHtcbiAgICAgICAgaWYgKHNhZmVfbm90X2VxdWFsKHZhbHVlLCBuZXdfdmFsdWUpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG5ld192YWx1ZTtcbiAgICAgICAgICAgIGlmIChzdG9wKSB7IC8vIHN0b3JlIGlzIHJlYWR5XG4gICAgICAgICAgICAgICAgY29uc3QgcnVuX3F1ZXVlID0gIXN1YnNjcmliZXJfcXVldWUubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgc3Vic2NyaWJlciBvZiBzdWJzY3JpYmVycykge1xuICAgICAgICAgICAgICAgICAgICBzdWJzY3JpYmVyWzFdKCk7XG4gICAgICAgICAgICAgICAgICAgIHN1YnNjcmliZXJfcXVldWUucHVzaChzdWJzY3JpYmVyLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChydW5fcXVldWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdWJzY3JpYmVyX3F1ZXVlLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWJzY3JpYmVyX3F1ZXVlW2ldWzBdKHN1YnNjcmliZXJfcXVldWVbaSArIDFdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzdWJzY3JpYmVyX3F1ZXVlLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIHVwZGF0ZShmbikge1xuICAgICAgICBzZXQoZm4odmFsdWUpKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gc3Vic2NyaWJlKHJ1biwgaW52YWxpZGF0ZSA9IG5vb3ApIHtcbiAgICAgICAgY29uc3Qgc3Vic2NyaWJlciA9IFtydW4sIGludmFsaWRhdGVdO1xuICAgICAgICBzdWJzY3JpYmVycy5hZGQoc3Vic2NyaWJlcik7XG4gICAgICAgIGlmIChzdWJzY3JpYmVycy5zaXplID09PSAxKSB7XG4gICAgICAgICAgICBzdG9wID0gc3RhcnQoc2V0KSB8fCBub29wO1xuICAgICAgICB9XG4gICAgICAgIHJ1bih2YWx1ZSk7XG4gICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICBzdWJzY3JpYmVycy5kZWxldGUoc3Vic2NyaWJlcik7XG4gICAgICAgICAgICBpZiAoc3Vic2NyaWJlcnMuc2l6ZSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHN0b3AoKTtcbiAgICAgICAgICAgICAgICBzdG9wID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIHsgc2V0LCB1cGRhdGUsIHN1YnNjcmliZSB9O1xufVxuZnVuY3Rpb24gZGVyaXZlZChzdG9yZXMsIGZuLCBpbml0aWFsX3ZhbHVlKSB7XG4gICAgY29uc3Qgc2luZ2xlID0gIUFycmF5LmlzQXJyYXkoc3RvcmVzKTtcbiAgICBjb25zdCBzdG9yZXNfYXJyYXkgPSBzaW5nbGVcbiAgICAgICAgPyBbc3RvcmVzXVxuICAgICAgICA6IHN0b3JlcztcbiAgICBjb25zdCBhdXRvID0gZm4ubGVuZ3RoIDwgMjtcbiAgICByZXR1cm4gcmVhZGFibGUoaW5pdGlhbF92YWx1ZSwgKHNldCkgPT4ge1xuICAgICAgICBsZXQgaW5pdGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IFtdO1xuICAgICAgICBsZXQgcGVuZGluZyA9IDA7XG4gICAgICAgIGxldCBjbGVhbnVwID0gbm9vcDtcbiAgICAgICAgY29uc3Qgc3luYyA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmIChwZW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2xlYW51cCgpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gZm4oc2luZ2xlID8gdmFsdWVzWzBdIDogdmFsdWVzLCBzZXQpO1xuICAgICAgICAgICAgaWYgKGF1dG8pIHtcbiAgICAgICAgICAgICAgICBzZXQocmVzdWx0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsZWFudXAgPSBpc19mdW5jdGlvbihyZXN1bHQpID8gcmVzdWx0IDogbm9vcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgdW5zdWJzY3JpYmVycyA9IHN0b3Jlc19hcnJheS5tYXAoKHN0b3JlLCBpKSA9PiBzdWJzY3JpYmUoc3RvcmUsICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdmFsdWVzW2ldID0gdmFsdWU7XG4gICAgICAgICAgICBwZW5kaW5nICY9IH4oMSA8PCBpKTtcbiAgICAgICAgICAgIGlmIChpbml0ZWQpIHtcbiAgICAgICAgICAgICAgICBzeW5jKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sICgpID0+IHtcbiAgICAgICAgICAgIHBlbmRpbmcgfD0gKDEgPDwgaSk7XG4gICAgICAgIH0pKTtcbiAgICAgICAgaW5pdGVkID0gdHJ1ZTtcbiAgICAgICAgc3luYygpO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gc3RvcCgpIHtcbiAgICAgICAgICAgIHJ1bl9hbGwodW5zdWJzY3JpYmVycyk7XG4gICAgICAgICAgICBjbGVhbnVwKCk7XG4gICAgICAgIH07XG4gICAgfSk7XG59XG5cbmV4cG9ydCB7IGRlcml2ZWQsIHJlYWRhYmxlLCB3cml0YWJsZSB9O1xuIiwiaW1wb3J0IHsgd3JpdGFibGUgfSBmcm9tICdzdmVsdGUvc3RvcmUnO1xuXG5leHBvcnQgY29uc3QgQ09OVEVYVF9LRVkgPSB7fTtcblxuZXhwb3J0IGNvbnN0IHByZWxvYWQgPSAoKSA9PiAoe30pOyIsIjxzY3JpcHQ+XG5cdGV4cG9ydCBsZXQgc2VnbWVudDtcbjwvc2NyaXB0PlxuXG48c3R5bGU+XG5cdG5hdiB7XG5cdFx0Ym9yZGVyLWJvdHRvbTogMXB4IHNvbGlkIHJnYmEoMjU1LDYyLDAsMC4xKTtcblx0XHRmb250LXdlaWdodDogMzAwO1xuXHRcdHBhZGRpbmc6IDAgMWVtO1xuXHR9XG5cblx0dWwge1xuXHRcdG1hcmdpbjogMDtcblx0XHRwYWRkaW5nOiAwO1xuXHR9XG5cblx0LyogY2xlYXJmaXggKi9cblx0dWw6OmFmdGVyIHtcblx0XHRjb250ZW50OiAnJztcblx0XHRkaXNwbGF5OiBibG9jaztcblx0XHRjbGVhcjogYm90aDtcblx0fVxuXG5cdGxpIHtcblx0XHRkaXNwbGF5OiBibG9jaztcblx0XHRmbG9hdDogbGVmdDtcblx0fVxuXG5cdFthcmlhLWN1cnJlbnRdIHtcblx0XHRwb3NpdGlvbjogcmVsYXRpdmU7XG5cdFx0ZGlzcGxheTogaW5saW5lLWJsb2NrO1xuXHR9XG5cblx0W2FyaWEtY3VycmVudF06OmFmdGVyIHtcblx0XHRwb3NpdGlvbjogYWJzb2x1dGU7XG5cdFx0Y29udGVudDogJyc7XG5cdFx0d2lkdGg6IGNhbGMoMTAwJSAtIDFlbSk7XG5cdFx0aGVpZ2h0OiAycHg7XG5cdFx0YmFja2dyb3VuZC1jb2xvcjogcmdiKDI1NSw2MiwwKTtcblx0XHRkaXNwbGF5OiBibG9jaztcblx0XHRib3R0b206IC0xcHg7XG5cdH1cblxuXHRhIHtcblx0XHR0ZXh0LWRlY29yYXRpb246IG5vbmU7XG5cdFx0cGFkZGluZzogMWVtIDAuNWVtO1xuXHRcdGRpc3BsYXk6IGJsb2NrO1xuXHR9XG48L3N0eWxlPlxuXG48bmF2PlxuXHQ8dWw+XG5cdFx0PGxpPjxhIGFyaWEtY3VycmVudD1cIntzZWdtZW50ID09PSB1bmRlZmluZWQgPyAncGFnZScgOiB1bmRlZmluZWR9XCIgaHJlZj1cIi5cIj5ob21lPC9hPjwvbGk+XG5cdFx0PGxpPjxhIGFyaWEtY3VycmVudD1cIntzZWdtZW50ID09PSAnYWJvdXQnID8gJ3BhZ2UnIDogdW5kZWZpbmVkfVwiIGhyZWY9XCJhYm91dFwiPmFib3V0PC9hPjwvbGk+XG5cblx0XHQ8IS0tIGZvciB0aGUgYmxvZyBsaW5rLCB3ZSdyZSB1c2luZyByZWw9cHJlZmV0Y2ggc28gdGhhdCBTYXBwZXIgcHJlZmV0Y2hlc1xuXHRcdCAgICAgdGhlIGJsb2cgZGF0YSB3aGVuIHdlIGhvdmVyIG92ZXIgdGhlIGxpbmsgb3IgdGFwIGl0IG9uIGEgdG91Y2hzY3JlZW4gLS0+XG5cdFx0PGxpPjxhIHJlbD1wcmVmZXRjaCBhcmlhLWN1cnJlbnQ9XCJ7c2VnbWVudCA9PT0gJ2Jsb2cnID8gJ3BhZ2UnIDogdW5kZWZpbmVkfVwiIGhyZWY9XCJibG9nXCI+YmxvZzwvYT48L2xpPlxuXHQ8L3VsPlxuPC9uYXY+XG4iLCI8c2NyaXB0PlxuXHRpbXBvcnQgTmF2IGZyb20gJy4uL2NvbXBvbmVudHMvTmF2LnN2ZWx0ZSc7XG5cblx0ZXhwb3J0IGxldCBzZWdtZW50O1xuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cblx0bWFpbiB7XG5cdFx0cG9zaXRpb246IHJlbGF0aXZlO1xuXHRcdG1heC13aWR0aDogNTZlbTtcblx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB3aGl0ZTtcblx0XHRwYWRkaW5nOiAyZW07XG5cdFx0bWFyZ2luOiAwIGF1dG87XG5cdFx0Ym94LXNpemluZzogYm9yZGVyLWJveDtcblx0fVxuPC9zdHlsZT5cblxuPE5hdiB7c2VnbWVudH0vPlxuXG48bWFpbj5cblx0PHNsb3Q+PC9zbG90PlxuPC9tYWluPiIsIjxzY3JpcHQ+XG5cdGV4cG9ydCBsZXQgc3RhdHVzO1xuXHRleHBvcnQgbGV0IGVycm9yO1xuXG5cdGNvbnN0IGRldiA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnO1xuPC9zY3JpcHQ+XG5cbjxzdHlsZT5cblx0aDEsIHAge1xuXHRcdG1hcmdpbjogMCBhdXRvO1xuXHR9XG5cblx0aDEge1xuXHRcdGZvbnQtc2l6ZTogMi44ZW07XG5cdFx0Zm9udC13ZWlnaHQ6IDcwMDtcblx0XHRtYXJnaW46IDAgMCAwLjVlbSAwO1xuXHR9XG5cblx0cCB7XG5cdFx0bWFyZ2luOiAxZW0gYXV0bztcblx0fVxuXG5cdEBtZWRpYSAobWluLXdpZHRoOiA0ODBweCkge1xuXHRcdGgxIHtcblx0XHRcdGZvbnQtc2l6ZTogNGVtO1xuXHRcdH1cblx0fVxuPC9zdHlsZT5cblxuPHN2ZWx0ZTpoZWFkPlxuXHQ8dGl0bGU+e3N0YXR1c308L3RpdGxlPlxuPC9zdmVsdGU6aGVhZD5cblxuPGgxPntzdGF0dXN9PC9oMT5cblxuPHA+e2Vycm9yLm1lc3NhZ2V9PC9wPlxuXG57I2lmIGRldiAmJiBlcnJvci5zdGFja31cblx0PHByZT57ZXJyb3Iuc3RhY2t9PC9wcmU+XG57L2lmfVxuIiwiPCEtLSBUaGlzIGZpbGUgaXMgZ2VuZXJhdGVkIGJ5IFNhcHBlciDigJQgZG8gbm90IGVkaXQgaXQhIC0tPlxuPHNjcmlwdD5cblx0aW1wb3J0IHsgc2V0Q29udGV4dCwgYWZ0ZXJVcGRhdGUgfSBmcm9tICdzdmVsdGUnO1xuXHRpbXBvcnQgeyBDT05URVhUX0tFWSB9IGZyb20gJy4vc2hhcmVkJztcblx0aW1wb3J0IExheW91dCBmcm9tICcuLi8uLi8uLi9yb3V0ZXMvX2xheW91dC5zdmVsdGUnO1xuXHRpbXBvcnQgRXJyb3IgZnJvbSAnLi4vLi4vLi4vcm91dGVzL19lcnJvci5zdmVsdGUnO1xuXG5cdGV4cG9ydCBsZXQgc3RvcmVzO1xuXHRleHBvcnQgbGV0IGVycm9yO1xuXHRleHBvcnQgbGV0IHN0YXR1cztcblx0ZXhwb3J0IGxldCBzZWdtZW50cztcblx0ZXhwb3J0IGxldCBsZXZlbDA7XG5cdGV4cG9ydCBsZXQgbGV2ZWwxID0gbnVsbDtcblx0ZXhwb3J0IGxldCBub3RpZnk7XG5cblx0YWZ0ZXJVcGRhdGUobm90aWZ5KTtcblx0c2V0Q29udGV4dChDT05URVhUX0tFWSwgc3RvcmVzKTtcbjwvc2NyaXB0PlxuXG48TGF5b3V0IHNlZ21lbnQ9XCJ7c2VnbWVudHNbMF19XCIgey4uLmxldmVsMC5wcm9wc30+XG5cdHsjaWYgZXJyb3J9XG5cdFx0PEVycm9yIHtlcnJvcn0ge3N0YXR1c30vPlxuXHR7OmVsc2V9XG5cdFx0PHN2ZWx0ZTpjb21wb25lbnQgdGhpcz1cIntsZXZlbDEuY29tcG9uZW50fVwiIHsuLi5sZXZlbDEucHJvcHN9Lz5cblx0ey9pZn1cbjwvTGF5b3V0PiIsIi8vIFRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYnkgU2FwcGVyIOKAlCBkbyBub3QgZWRpdCBpdCFcbi8vIHdlYnBhY2sgZG9lcyBub3Qgc3VwcG9ydCBleHBvcnQgKiBhcyByb290X2NvbXAgeWV0IHNvIGRvIGEgdHdvIGxpbmUgaW1wb3J0L2V4cG9ydFxuaW1wb3J0ICogYXMgcm9vdF9jb21wIGZyb20gJy4uLy4uLy4uL3JvdXRlcy9fbGF5b3V0LnN2ZWx0ZSc7XG5leHBvcnQgeyByb290X2NvbXAgfTtcbmV4cG9ydCB7IGRlZmF1bHQgYXMgRXJyb3JDb21wb25lbnQgfSBmcm9tICcuLi8uLi8uLi9yb3V0ZXMvX2Vycm9yLnN2ZWx0ZSc7XG5cbmV4cG9ydCBjb25zdCBpZ25vcmUgPSBbL15cXC9ibG9nXFwuanNvbiQvLCAvXlxcL2Jsb2dcXC8oW14vXSs/KVxcLmpzb24kL107XG5cbmV4cG9ydCBjb25zdCBjb21wb25lbnRzID0gW1xuXHR7XG5cdFx0anM6ICgpID0+IGltcG9ydChcIi4uLy4uLy4uL3JvdXRlcy9pbmRleC5zdmVsdGVcIilcblx0fSxcblx0e1xuXHRcdGpzOiAoKSA9PiBpbXBvcnQoXCIuLi8uLi8uLi9yb3V0ZXMvYWJvdXQuc3ZlbHRlXCIpXG5cdH0sXG5cdHtcblx0XHRqczogKCkgPT4gaW1wb3J0KFwiLi4vLi4vLi4vcm91dGVzL2Jsb2cvaW5kZXguc3ZlbHRlXCIpXG5cdH0sXG5cdHtcblx0XHRqczogKCkgPT4gaW1wb3J0KFwiLi4vLi4vLi4vcm91dGVzL2Jsb2cvW3NsdWddLnN2ZWx0ZVwiKVxuXHR9XG5dO1xuXG5leHBvcnQgY29uc3Qgcm91dGVzID0gKGQgPT4gW1xuXHR7XG5cdFx0Ly8gaW5kZXguc3ZlbHRlXG5cdFx0cGF0dGVybjogL15cXC8kLyxcblx0XHRwYXJ0czogW1xuXHRcdFx0eyBpOiAwIH1cblx0XHRdXG5cdH0sXG5cblx0e1xuXHRcdC8vIGFib3V0LnN2ZWx0ZVxuXHRcdHBhdHRlcm46IC9eXFwvYWJvdXRcXC8/JC8sXG5cdFx0cGFydHM6IFtcblx0XHRcdHsgaTogMSB9XG5cdFx0XVxuXHR9LFxuXG5cdHtcblx0XHQvLyBibG9nL2luZGV4LnN2ZWx0ZVxuXHRcdHBhdHRlcm46IC9eXFwvYmxvZ1xcLz8kLyxcblx0XHRwYXJ0czogW1xuXHRcdFx0eyBpOiAyIH1cblx0XHRdXG5cdH0sXG5cblx0e1xuXHRcdC8vIGJsb2cvW3NsdWddLnN2ZWx0ZVxuXHRcdHBhdHRlcm46IC9eXFwvYmxvZ1xcLyhbXi9dKz8pXFwvPyQvLFxuXHRcdHBhcnRzOiBbXG5cdFx0XHRudWxsLFxuXHRcdFx0eyBpOiAzLCBwYXJhbXM6IG1hdGNoID0+ICh7IHNsdWc6IGQobWF0Y2hbMV0pIH0pIH1cblx0XHRdXG5cdH1cbl0pKGRlY29kZVVSSUNvbXBvbmVudCk7XG5cbmlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuXHRpbXBvcnQoXCIvVXNlcnMva2F6dWhpc2FmdWt1ZGEvZGV2L2xlYXJuLXN2ZWx0ZS1zYXBwZXIvbXktc2FwcGVyLWFwcC9ub2RlX21vZHVsZXMvc2FwcGVyL3NhcHBlci1kZXYtY2xpZW50LmpzXCIpLnRoZW4oY2xpZW50ID0+IHtcblx0XHRjbGllbnQuY29ubmVjdCgxMDAwMCk7XG5cdH0pO1xufSIsImltcG9ydCB7IGdldENvbnRleHQgfSBmcm9tICdzdmVsdGUnO1xuaW1wb3J0IHsgQ09OVEVYVF9LRVkgfSBmcm9tICcuL2ludGVybmFsL3NoYXJlZCc7XG5pbXBvcnQgeyB3cml0YWJsZSB9IGZyb20gJ3N2ZWx0ZS9zdG9yZSc7XG5pbXBvcnQgQXBwIGZyb20gJy4vaW50ZXJuYWwvQXBwLnN2ZWx0ZSc7XG5pbXBvcnQgeyBpZ25vcmUsIHJvdXRlcywgcm9vdF9jb21wLCBjb21wb25lbnRzLCBFcnJvckNvbXBvbmVudCB9IGZyb20gJy4vaW50ZXJuYWwvbWFuaWZlc3QtY2xpZW50JztcblxuLyohICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuXHJcbmZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cblxuZnVuY3Rpb24gZmluZF9hbmNob3Iobm9kZSkge1xyXG4gICAgd2hpbGUgKG5vZGUgJiYgbm9kZS5ub2RlTmFtZS50b1VwcGVyQ2FzZSgpICE9PSAnQScpXHJcbiAgICAgICAgbm9kZSA9IG5vZGUucGFyZW50Tm9kZTsgLy8gU1ZHIDxhPiBlbGVtZW50cyBoYXZlIGEgbG93ZXJjYXNlIG5hbWVcclxuICAgIHJldHVybiBub2RlO1xyXG59XG5cbmxldCB1aWQgPSAxO1xyXG5mdW5jdGlvbiBzZXRfdWlkKG4pIHtcclxuICAgIHVpZCA9IG47XHJcbn1cclxubGV0IGNpZDtcclxuZnVuY3Rpb24gc2V0X2NpZChuKSB7XHJcbiAgICBjaWQgPSBuO1xyXG59XHJcbmNvbnN0IF9oaXN0b3J5ID0gdHlwZW9mIGhpc3RvcnkgIT09ICd1bmRlZmluZWQnID8gaGlzdG9yeSA6IHtcclxuICAgIHB1c2hTdGF0ZTogKCkgPT4geyB9LFxyXG4gICAgcmVwbGFjZVN0YXRlOiAoKSA9PiB7IH0sXHJcbiAgICBzY3JvbGxSZXN0b3JhdGlvbjogJ2F1dG8nXHJcbn07XHJcbmNvbnN0IHNjcm9sbF9oaXN0b3J5ID0ge307XHJcbmZ1bmN0aW9uIGxvYWRfY3VycmVudF9wYWdlKCkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHsgaGFzaCwgaHJlZiB9ID0gbG9jYXRpb247XHJcbiAgICAgICAgX2hpc3RvcnkucmVwbGFjZVN0YXRlKHsgaWQ6IHVpZCB9LCAnJywgaHJlZik7XHJcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gc2VsZWN0X3RhcmdldChuZXcgVVJMKGxvY2F0aW9uLmhyZWYpKTtcclxuICAgICAgICBpZiAodGFyZ2V0KVxyXG4gICAgICAgICAgICByZXR1cm4gbmF2aWdhdGUodGFyZ2V0LCB1aWQsIHRydWUsIGhhc2gpO1xyXG4gICAgfSk7XHJcbn1cclxubGV0IGJhc2VfdXJsO1xyXG5sZXQgaGFuZGxlX3RhcmdldDtcclxuZnVuY3Rpb24gaW5pdChiYXNlLCBoYW5kbGVyKSB7XHJcbiAgICBiYXNlX3VybCA9IGJhc2U7XHJcbiAgICBoYW5kbGVfdGFyZ2V0ID0gaGFuZGxlcjtcclxuICAgIGlmICgnc2Nyb2xsUmVzdG9yYXRpb24nIGluIF9oaXN0b3J5KSB7XHJcbiAgICAgICAgX2hpc3Rvcnkuc2Nyb2xsUmVzdG9yYXRpb24gPSAnbWFudWFsJztcclxuICAgIH1cclxuICAgIC8vIEFkb3B0ZWQgZnJvbSBOdXh0LmpzXHJcbiAgICAvLyBSZXNldCBzY3JvbGxSZXN0b3JhdGlvbiB0byBhdXRvIHdoZW4gbGVhdmluZyBwYWdlLCBhbGxvd2luZyBwYWdlIHJlbG9hZFxyXG4gICAgLy8gYW5kIGJhY2stbmF2aWdhdGlvbiBmcm9tIG90aGVyIHBhZ2VzIHRvIHVzZSB0aGUgYnJvd3NlciB0byByZXN0b3JlIHRoZVxyXG4gICAgLy8gc2Nyb2xsaW5nIHBvc2l0aW9uLlxyXG4gICAgYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgKCkgPT4ge1xyXG4gICAgICAgIF9oaXN0b3J5LnNjcm9sbFJlc3RvcmF0aW9uID0gJ2F1dG8nO1xyXG4gICAgfSk7XHJcbiAgICAvLyBTZXR0aW5nIHNjcm9sbFJlc3RvcmF0aW9uIHRvIG1hbnVhbCBhZ2FpbiB3aGVuIHJldHVybmluZyB0byB0aGlzIHBhZ2UuXHJcbiAgICBhZGRFdmVudExpc3RlbmVyKCdsb2FkJywgKCkgPT4ge1xyXG4gICAgICAgIF9oaXN0b3J5LnNjcm9sbFJlc3RvcmF0aW9uID0gJ21hbnVhbCc7XHJcbiAgICB9KTtcclxuICAgIGFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGFuZGxlX2NsaWNrKTtcclxuICAgIGFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgaGFuZGxlX3BvcHN0YXRlKTtcclxufVxyXG5mdW5jdGlvbiBleHRyYWN0X3F1ZXJ5KHNlYXJjaCkge1xyXG4gICAgY29uc3QgcXVlcnkgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xyXG4gICAgaWYgKHNlYXJjaC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgc2VhcmNoLnNsaWNlKDEpLnNwbGl0KCcmJykuZm9yRWFjaChzZWFyY2hQYXJhbSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IFssIGtleSwgdmFsdWUgPSAnJ10gPSAvKFtePV0qKSg/Oj0oLiopKT8vLmV4ZWMoZGVjb2RlVVJJQ29tcG9uZW50KHNlYXJjaFBhcmFtLnJlcGxhY2UoL1xcKy9nLCAnICcpKSk7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcXVlcnlba2V5XSA9PT0gJ3N0cmluZycpXHJcbiAgICAgICAgICAgICAgICBxdWVyeVtrZXldID0gW3F1ZXJ5W2tleV1dO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHF1ZXJ5W2tleV0gPT09ICdvYmplY3QnKVxyXG4gICAgICAgICAgICAgICAgcXVlcnlba2V5XS5wdXNoKHZhbHVlKTtcclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgcXVlcnlba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHF1ZXJ5O1xyXG59XHJcbmZ1bmN0aW9uIHNlbGVjdF90YXJnZXQodXJsKSB7XHJcbiAgICBpZiAodXJsLm9yaWdpbiAhPT0gbG9jYXRpb24ub3JpZ2luKVxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgaWYgKCF1cmwucGF0aG5hbWUuc3RhcnRzV2l0aChiYXNlX3VybCkpXHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICBsZXQgcGF0aCA9IHVybC5wYXRobmFtZS5zbGljZShiYXNlX3VybC5sZW5ndGgpO1xyXG4gICAgaWYgKHBhdGggPT09ICcnKSB7XHJcbiAgICAgICAgcGF0aCA9ICcvJztcclxuICAgIH1cclxuICAgIC8vIGF2b2lkIGFjY2lkZW50YWwgY2xhc2hlcyBiZXR3ZWVuIHNlcnZlciByb3V0ZXMgYW5kIHBhZ2Ugcm91dGVzXHJcbiAgICBpZiAoaWdub3JlLnNvbWUocGF0dGVybiA9PiBwYXR0ZXJuLnRlc3QocGF0aCkpKVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcm91dGVzLmxlbmd0aDsgaSArPSAxKSB7XHJcbiAgICAgICAgY29uc3Qgcm91dGUgPSByb3V0ZXNbaV07XHJcbiAgICAgICAgY29uc3QgbWF0Y2ggPSByb3V0ZS5wYXR0ZXJuLmV4ZWMocGF0aCk7XHJcbiAgICAgICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHF1ZXJ5ID0gZXh0cmFjdF9xdWVyeSh1cmwuc2VhcmNoKTtcclxuICAgICAgICAgICAgY29uc3QgcGFydCA9IHJvdXRlLnBhcnRzW3JvdXRlLnBhcnRzLmxlbmd0aCAtIDFdO1xyXG4gICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBwYXJ0LnBhcmFtcyA/IHBhcnQucGFyYW1zKG1hdGNoKSA6IHt9O1xyXG4gICAgICAgICAgICBjb25zdCBwYWdlID0geyBob3N0OiBsb2NhdGlvbi5ob3N0LCBwYXRoLCBxdWVyeSwgcGFyYW1zIH07XHJcbiAgICAgICAgICAgIHJldHVybiB7IGhyZWY6IHVybC5ocmVmLCByb3V0ZSwgbWF0Y2gsIHBhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuZnVuY3Rpb24gaGFuZGxlX2NsaWNrKGV2ZW50KSB7XHJcbiAgICAvLyBBZGFwdGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL3Zpc2lvbm1lZGlhL3BhZ2UuanNcclxuICAgIC8vIE1JVCBsaWNlbnNlIGh0dHBzOi8vZ2l0aHViLmNvbS92aXNpb25tZWRpYS9wYWdlLmpzI2xpY2Vuc2VcclxuICAgIGlmICh3aGljaChldmVudCkgIT09IDEpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgaWYgKGV2ZW50Lm1ldGFLZXkgfHwgZXZlbnQuY3RybEtleSB8fCBldmVudC5zaGlmdEtleSB8fCBldmVudC5hbHRLZXkpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgaWYgKGV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgY29uc3QgYSA9IGZpbmRfYW5jaG9yKGV2ZW50LnRhcmdldCk7XHJcbiAgICBpZiAoIWEpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgaWYgKCFhLmhyZWYpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgLy8gY2hlY2sgaWYgbGluayBpcyBpbnNpZGUgYW4gc3ZnXHJcbiAgICAvLyBpbiB0aGlzIGNhc2UsIGJvdGggaHJlZiBhbmQgdGFyZ2V0IGFyZSBhbHdheXMgaW5zaWRlIGFuIG9iamVjdFxyXG4gICAgY29uc3Qgc3ZnID0gdHlwZW9mIGEuaHJlZiA9PT0gJ29iamVjdCcgJiYgYS5ocmVmLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdTVkdBbmltYXRlZFN0cmluZyc7XHJcbiAgICBjb25zdCBocmVmID0gU3RyaW5nKHN2ZyA/IGEuaHJlZi5iYXNlVmFsIDogYS5ocmVmKTtcclxuICAgIGlmIChocmVmID09PSBsb2NhdGlvbi5ocmVmKSB7XHJcbiAgICAgICAgaWYgKCFsb2NhdGlvbi5oYXNoKVxyXG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIC8vIElnbm9yZSBpZiB0YWcgaGFzXHJcbiAgICAvLyAxLiAnZG93bmxvYWQnIGF0dHJpYnV0ZVxyXG4gICAgLy8gMi4gcmVsPSdleHRlcm5hbCcgYXR0cmlidXRlXHJcbiAgICBpZiAoYS5oYXNBdHRyaWJ1dGUoJ2Rvd25sb2FkJykgfHwgYS5nZXRBdHRyaWJ1dGUoJ3JlbCcpID09PSAnZXh0ZXJuYWwnKVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIC8vIElnbm9yZSBpZiA8YT4gaGFzIGEgdGFyZ2V0XHJcbiAgICBpZiAoc3ZnID8gYS50YXJnZXQuYmFzZVZhbCA6IGEudGFyZ2V0KVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoaHJlZik7XHJcbiAgICAvLyBEb24ndCBoYW5kbGUgaGFzaCBjaGFuZ2VzXHJcbiAgICBpZiAodXJsLnBhdGhuYW1lID09PSBsb2NhdGlvbi5wYXRobmFtZSAmJiB1cmwuc2VhcmNoID09PSBsb2NhdGlvbi5zZWFyY2gpXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgY29uc3QgdGFyZ2V0ID0gc2VsZWN0X3RhcmdldCh1cmwpO1xyXG4gICAgaWYgKHRhcmdldCkge1xyXG4gICAgICAgIGNvbnN0IG5vc2Nyb2xsID0gYS5oYXNBdHRyaWJ1dGUoJ3NhcHBlcjpub3Njcm9sbCcpO1xyXG4gICAgICAgIG5hdmlnYXRlKHRhcmdldCwgbnVsbCwgbm9zY3JvbGwsIHVybC5oYXNoKTtcclxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgIF9oaXN0b3J5LnB1c2hTdGF0ZSh7IGlkOiBjaWQgfSwgJycsIHVybC5ocmVmKTtcclxuICAgIH1cclxufVxyXG5mdW5jdGlvbiB3aGljaChldmVudCkge1xyXG4gICAgcmV0dXJuIGV2ZW50LndoaWNoID09PSBudWxsID8gZXZlbnQuYnV0dG9uIDogZXZlbnQud2hpY2g7XHJcbn1cclxuZnVuY3Rpb24gc2Nyb2xsX3N0YXRlKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICB4OiBwYWdlWE9mZnNldCxcclxuICAgICAgICB5OiBwYWdlWU9mZnNldFxyXG4gICAgfTtcclxufVxyXG5mdW5jdGlvbiBoYW5kbGVfcG9wc3RhdGUoZXZlbnQpIHtcclxuICAgIHNjcm9sbF9oaXN0b3J5W2NpZF0gPSBzY3JvbGxfc3RhdGUoKTtcclxuICAgIGlmIChldmVudC5zdGF0ZSkge1xyXG4gICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XHJcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gc2VsZWN0X3RhcmdldCh1cmwpO1xyXG4gICAgICAgIGlmICh0YXJnZXQpIHtcclxuICAgICAgICAgICAgbmF2aWdhdGUodGFyZ2V0LCBldmVudC5zdGF0ZS5pZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcclxuICAgICAgICAgICAgbG9jYXRpb24uaHJlZiA9IGxvY2F0aW9uLmhyZWY7IC8vIG5vc29uYXJcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICAvLyBoYXNoY2hhbmdlXHJcbiAgICAgICAgc2V0X3VpZCh1aWQgKyAxKTtcclxuICAgICAgICBzZXRfY2lkKHVpZCk7XHJcbiAgICAgICAgX2hpc3RvcnkucmVwbGFjZVN0YXRlKHsgaWQ6IGNpZCB9LCAnJywgbG9jYXRpb24uaHJlZik7XHJcbiAgICB9XHJcbn1cclxuZnVuY3Rpb24gbmF2aWdhdGUoZGVzdCwgaWQsIG5vc2Nyb2xsLCBoYXNoKSB7XHJcbiAgICByZXR1cm4gX19hd2FpdGVyKHRoaXMsIHZvaWQgMCwgdm9pZCAwLCBmdW5jdGlvbiogKCkge1xyXG4gICAgICAgIGNvbnN0IHBvcHN0YXRlID0gISFpZDtcclxuICAgICAgICBpZiAocG9wc3RhdGUpIHtcclxuICAgICAgICAgICAgY2lkID0gaWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCBjdXJyZW50X3Njcm9sbCA9IHNjcm9sbF9zdGF0ZSgpO1xyXG4gICAgICAgICAgICAvLyBjbGlja2VkIG9uIGEgbGluay4gcHJlc2VydmUgc2Nyb2xsIHN0YXRlXHJcbiAgICAgICAgICAgIHNjcm9sbF9oaXN0b3J5W2NpZF0gPSBjdXJyZW50X3Njcm9sbDtcclxuICAgICAgICAgICAgY2lkID0gaWQgPSArK3VpZDtcclxuICAgICAgICAgICAgc2Nyb2xsX2hpc3RvcnlbY2lkXSA9IG5vc2Nyb2xsID8gY3VycmVudF9zY3JvbGwgOiB7IHg6IDAsIHk6IDAgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgeWllbGQgaGFuZGxlX3RhcmdldChkZXN0KTtcclxuICAgICAgICBpZiAoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJiAoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSlcclxuICAgICAgICAgICAgZG9jdW1lbnQuYWN0aXZlRWxlbWVudC5ibHVyKCk7XHJcbiAgICAgICAgaWYgKCFub3Njcm9sbCkge1xyXG4gICAgICAgICAgICBsZXQgc2Nyb2xsID0gc2Nyb2xsX2hpc3RvcnlbaWRdO1xyXG4gICAgICAgICAgICBsZXQgZGVlcF9saW5rZWQ7XHJcbiAgICAgICAgICAgIGlmIChoYXNoKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBzY3JvbGwgaXMgYW4gZWxlbWVudCBpZCAoZnJvbSBhIGhhc2gpLCB3ZSBuZWVkIHRvIGNvbXB1dGUgeS5cclxuICAgICAgICAgICAgICAgIGRlZXBfbGlua2VkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaGFzaC5zbGljZSgxKSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoZGVlcF9saW5rZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBzY3JvbGwgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHg6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHk6IGRlZXBfbGlua2VkLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcCArIHNjcm9sbFlcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHNjcm9sbF9oaXN0b3J5W2NpZF0gPSBzY3JvbGw7XHJcbiAgICAgICAgICAgIGlmIChwb3BzdGF0ZSB8fCBkZWVwX2xpbmtlZCkge1xyXG4gICAgICAgICAgICAgICAgc2Nyb2xsVG8oc2Nyb2xsLngsIHNjcm9sbC55KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHNjcm9sbFRvKDAsIDApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn1cblxuZnVuY3Rpb24gZ2V0X2Jhc2VfdXJpKHdpbmRvd19kb2N1bWVudCkge1xyXG4gICAgbGV0IGJhc2VVUkkgPSB3aW5kb3dfZG9jdW1lbnQuYmFzZVVSSTtcclxuICAgIGlmICghYmFzZVVSSSkge1xyXG4gICAgICAgIGNvbnN0IGJhc2VUYWdzID0gd2luZG93X2RvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdiYXNlJyk7XHJcbiAgICAgICAgYmFzZVVSSSA9IGJhc2VUYWdzLmxlbmd0aCA/IGJhc2VUYWdzWzBdLmhyZWYgOiB3aW5kb3dfZG9jdW1lbnQuVVJMO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGJhc2VVUkk7XHJcbn1cblxubGV0IHByZWZldGNoaW5nID0gbnVsbDtcclxubGV0IG1vdXNlbW92ZV90aW1lb3V0O1xyXG5mdW5jdGlvbiBzdGFydCgpIHtcclxuICAgIGFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0cmlnZ2VyX3ByZWZldGNoKTtcclxuICAgIGFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIGhhbmRsZV9tb3VzZW1vdmUpO1xyXG59XHJcbmZ1bmN0aW9uIHByZWZldGNoKGhyZWYpIHtcclxuICAgIGNvbnN0IHRhcmdldCA9IHNlbGVjdF90YXJnZXQobmV3IFVSTChocmVmLCBnZXRfYmFzZV91cmkoZG9jdW1lbnQpKSk7XHJcbiAgICBpZiAodGFyZ2V0KSB7XHJcbiAgICAgICAgaWYgKCFwcmVmZXRjaGluZyB8fCBocmVmICE9PSBwcmVmZXRjaGluZy5ocmVmKSB7XHJcbiAgICAgICAgICAgIHByZWZldGNoaW5nID0geyBocmVmLCBwcm9taXNlOiBoeWRyYXRlX3RhcmdldCh0YXJnZXQpIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBwcmVmZXRjaGluZy5wcm9taXNlO1xyXG4gICAgfVxyXG59XHJcbmZ1bmN0aW9uIGdldF9wcmVmZXRjaGVkKHRhcmdldCkge1xyXG4gICAgaWYgKHByZWZldGNoaW5nICYmIHByZWZldGNoaW5nLmhyZWYgPT09IHRhcmdldC5ocmVmKSB7XHJcbiAgICAgICAgcmV0dXJuIHByZWZldGNoaW5nLnByb21pc2U7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICByZXR1cm4gaHlkcmF0ZV90YXJnZXQodGFyZ2V0KTtcclxuICAgIH1cclxufVxyXG5mdW5jdGlvbiB0cmlnZ2VyX3ByZWZldGNoKGV2ZW50KSB7XHJcbiAgICBjb25zdCBhID0gZmluZF9hbmNob3IoZXZlbnQudGFyZ2V0KTtcclxuICAgIGlmIChhICYmIGEucmVsID09PSAncHJlZmV0Y2gnKSB7XHJcbiAgICAgICAgcHJlZmV0Y2goYS5ocmVmKTtcclxuICAgIH1cclxufVxyXG5mdW5jdGlvbiBoYW5kbGVfbW91c2Vtb3ZlKGV2ZW50KSB7XHJcbiAgICBjbGVhclRpbWVvdXQobW91c2Vtb3ZlX3RpbWVvdXQpO1xyXG4gICAgbW91c2Vtb3ZlX3RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICB0cmlnZ2VyX3ByZWZldGNoKGV2ZW50KTtcclxuICAgIH0sIDIwKTtcclxufVxuXG5mdW5jdGlvbiBnb3RvKGhyZWYsIG9wdHMgPSB7IG5vc2Nyb2xsOiBmYWxzZSwgcmVwbGFjZVN0YXRlOiBmYWxzZSB9KSB7XHJcbiAgICBjb25zdCB0YXJnZXQgPSBzZWxlY3RfdGFyZ2V0KG5ldyBVUkwoaHJlZiwgZ2V0X2Jhc2VfdXJpKGRvY3VtZW50KSkpO1xyXG4gICAgaWYgKHRhcmdldCkge1xyXG4gICAgICAgIF9oaXN0b3J5W29wdHMucmVwbGFjZVN0YXRlID8gJ3JlcGxhY2VTdGF0ZScgOiAncHVzaFN0YXRlJ10oeyBpZDogY2lkIH0sICcnLCBocmVmKTtcclxuICAgICAgICByZXR1cm4gbmF2aWdhdGUodGFyZ2V0LCBudWxsLCBvcHRzLm5vc2Nyb2xsKTtcclxuICAgIH1cclxuICAgIGxvY2F0aW9uLmhyZWYgPSBocmVmO1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcclxuICAgICAgICAvKiBuZXZlciByZXNvbHZlcyAqL1xyXG4gICAgfSk7XHJcbn1cblxuZnVuY3Rpb24gcGFnZV9zdG9yZSh2YWx1ZSkge1xyXG4gICAgY29uc3Qgc3RvcmUgPSB3cml0YWJsZSh2YWx1ZSk7XHJcbiAgICBsZXQgcmVhZHkgPSB0cnVlO1xyXG4gICAgZnVuY3Rpb24gbm90aWZ5KCkge1xyXG4gICAgICAgIHJlYWR5ID0gdHJ1ZTtcclxuICAgICAgICBzdG9yZS51cGRhdGUodmFsID0+IHZhbCk7XHJcbiAgICB9XHJcbiAgICBmdW5jdGlvbiBzZXQobmV3X3ZhbHVlKSB7XHJcbiAgICAgICAgcmVhZHkgPSBmYWxzZTtcclxuICAgICAgICBzdG9yZS5zZXQobmV3X3ZhbHVlKTtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIHN1YnNjcmliZShydW4pIHtcclxuICAgICAgICBsZXQgb2xkX3ZhbHVlO1xyXG4gICAgICAgIHJldHVybiBzdG9yZS5zdWJzY3JpYmUoKG5ld192YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICBpZiAob2xkX3ZhbHVlID09PSB1bmRlZmluZWQgfHwgKHJlYWR5ICYmIG5ld192YWx1ZSAhPT0gb2xkX3ZhbHVlKSkge1xyXG4gICAgICAgICAgICAgICAgcnVuKG9sZF92YWx1ZSA9IG5ld192YWx1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiB7IG5vdGlmeSwgc2V0LCBzdWJzY3JpYmUgfTtcclxufVxuXG5jb25zdCBpbml0aWFsX2RhdGEgPSB0eXBlb2YgX19TQVBQRVJfXyAhPT0gJ3VuZGVmaW5lZCcgJiYgX19TQVBQRVJfXztcclxubGV0IHJlYWR5ID0gZmFsc2U7XHJcbmxldCByb290X2NvbXBvbmVudDtcclxubGV0IGN1cnJlbnRfdG9rZW47XHJcbmxldCByb290X3ByZWxvYWRlZDtcclxubGV0IGN1cnJlbnRfYnJhbmNoID0gW107XHJcbmxldCBjdXJyZW50X3F1ZXJ5ID0gJ3t9JztcclxuY29uc3Qgc3RvcmVzID0ge1xyXG4gICAgcGFnZTogcGFnZV9zdG9yZSh7fSksXHJcbiAgICBwcmVsb2FkaW5nOiB3cml0YWJsZShudWxsKSxcclxuICAgIHNlc3Npb246IHdyaXRhYmxlKGluaXRpYWxfZGF0YSAmJiBpbml0aWFsX2RhdGEuc2Vzc2lvbilcclxufTtcclxubGV0ICRzZXNzaW9uO1xyXG5sZXQgc2Vzc2lvbl9kaXJ0eTtcclxuc3RvcmVzLnNlc3Npb24uc3Vic2NyaWJlKCh2YWx1ZSkgPT4gX19hd2FpdGVyKHZvaWQgMCwgdm9pZCAwLCB2b2lkIDAsIGZ1bmN0aW9uKiAoKSB7XHJcbiAgICAkc2Vzc2lvbiA9IHZhbHVlO1xyXG4gICAgaWYgKCFyZWFkeSlcclxuICAgICAgICByZXR1cm47XHJcbiAgICBzZXNzaW9uX2RpcnR5ID0gdHJ1ZTtcclxuICAgIGNvbnN0IGRlc3QgPSBzZWxlY3RfdGFyZ2V0KG5ldyBVUkwobG9jYXRpb24uaHJlZikpO1xyXG4gICAgY29uc3QgdG9rZW4gPSBjdXJyZW50X3Rva2VuID0ge307XHJcbiAgICBjb25zdCB7IHJlZGlyZWN0LCBwcm9wcywgYnJhbmNoIH0gPSB5aWVsZCBoeWRyYXRlX3RhcmdldChkZXN0KTtcclxuICAgIGlmICh0b2tlbiAhPT0gY3VycmVudF90b2tlbilcclxuICAgICAgICByZXR1cm47IC8vIGEgc2Vjb25kYXJ5IG5hdmlnYXRpb24gaGFwcGVuZWQgd2hpbGUgd2Ugd2VyZSBsb2FkaW5nXHJcbiAgICBpZiAocmVkaXJlY3QpIHtcclxuICAgICAgICB5aWVsZCBnb3RvKHJlZGlyZWN0LmxvY2F0aW9uLCB7IHJlcGxhY2VTdGF0ZTogdHJ1ZSB9KTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHlpZWxkIHJlbmRlcihicmFuY2gsIHByb3BzLCBidWlsZFBhZ2VDb250ZXh0KHByb3BzLCBkZXN0LnBhZ2UpKTtcclxuICAgIH1cclxufSkpO1xyXG5sZXQgdGFyZ2V0O1xyXG5mdW5jdGlvbiBzZXRfdGFyZ2V0KG5vZGUpIHtcclxuICAgIHRhcmdldCA9IG5vZGU7XHJcbn1cclxuZnVuY3Rpb24gc3RhcnQkMShvcHRzKSB7XHJcbiAgICBzZXRfdGFyZ2V0KG9wdHMudGFyZ2V0KTtcclxuICAgIGluaXQoaW5pdGlhbF9kYXRhLmJhc2VVcmwsIGhhbmRsZV90YXJnZXQkMSk7XHJcbiAgICBzdGFydCgpO1xyXG4gICAgaWYgKGluaXRpYWxfZGF0YS5lcnJvcikge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZV9lcnJvcigpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGxvYWRfY3VycmVudF9wYWdlKCk7XHJcbn1cclxuZnVuY3Rpb24gaGFuZGxlX2Vycm9yKCkge1xyXG4gICAgY29uc3QgeyBob3N0LCBwYXRobmFtZSwgc2VhcmNoIH0gPSBsb2NhdGlvbjtcclxuICAgIGNvbnN0IHsgc2Vzc2lvbiwgcHJlbG9hZGVkLCBzdGF0dXMsIGVycm9yIH0gPSBpbml0aWFsX2RhdGE7XHJcbiAgICBpZiAoIXJvb3RfcHJlbG9hZGVkKSB7XHJcbiAgICAgICAgcm9vdF9wcmVsb2FkZWQgPSBwcmVsb2FkZWQgJiYgcHJlbG9hZGVkWzBdO1xyXG4gICAgfVxyXG4gICAgY29uc3QgcHJvcHMgPSB7XHJcbiAgICAgICAgZXJyb3IsXHJcbiAgICAgICAgc3RhdHVzLFxyXG4gICAgICAgIHNlc3Npb24sXHJcbiAgICAgICAgbGV2ZWwwOiB7XHJcbiAgICAgICAgICAgIHByb3BzOiByb290X3ByZWxvYWRlZFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbGV2ZWwxOiB7XHJcbiAgICAgICAgICAgIHByb3BzOiB7XHJcbiAgICAgICAgICAgICAgICBzdGF0dXMsXHJcbiAgICAgICAgICAgICAgICBlcnJvclxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjb21wb25lbnQ6IEVycm9yQ29tcG9uZW50XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzZWdtZW50czogcHJlbG9hZGVkXHJcbiAgICB9O1xyXG4gICAgY29uc3QgcXVlcnkgPSBleHRyYWN0X3F1ZXJ5KHNlYXJjaCk7XHJcbiAgICByZW5kZXIoW10sIHByb3BzLCB7IGhvc3QsIHBhdGg6IHBhdGhuYW1lLCBxdWVyeSwgcGFyYW1zOiB7fSwgZXJyb3IgfSk7XHJcbn1cclxuZnVuY3Rpb24gYnVpbGRQYWdlQ29udGV4dChwcm9wcywgcGFnZSkge1xyXG4gICAgY29uc3QgeyBlcnJvciB9ID0gcHJvcHM7XHJcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7IGVycm9yIH0sIHBhZ2UpO1xyXG59XHJcbmZ1bmN0aW9uIGhhbmRsZV90YXJnZXQkMShkZXN0KSB7XHJcbiAgICByZXR1cm4gX19hd2FpdGVyKHRoaXMsIHZvaWQgMCwgdm9pZCAwLCBmdW5jdGlvbiogKCkge1xyXG4gICAgICAgIGlmIChyb290X2NvbXBvbmVudClcclxuICAgICAgICAgICAgc3RvcmVzLnByZWxvYWRpbmcuc2V0KHRydWUpO1xyXG4gICAgICAgIGNvbnN0IGh5ZHJhdGluZyA9IGdldF9wcmVmZXRjaGVkKGRlc3QpO1xyXG4gICAgICAgIGNvbnN0IHRva2VuID0gY3VycmVudF90b2tlbiA9IHt9O1xyXG4gICAgICAgIGNvbnN0IGh5ZHJhdGVkX3RhcmdldCA9IHlpZWxkIGh5ZHJhdGluZztcclxuICAgICAgICBjb25zdCB7IHJlZGlyZWN0IH0gPSBoeWRyYXRlZF90YXJnZXQ7XHJcbiAgICAgICAgaWYgKHRva2VuICE9PSBjdXJyZW50X3Rva2VuKVxyXG4gICAgICAgICAgICByZXR1cm47IC8vIGEgc2Vjb25kYXJ5IG5hdmlnYXRpb24gaGFwcGVuZWQgd2hpbGUgd2Ugd2VyZSBsb2FkaW5nXHJcbiAgICAgICAgaWYgKHJlZGlyZWN0KSB7XHJcbiAgICAgICAgICAgIHlpZWxkIGdvdG8ocmVkaXJlY3QubG9jYXRpb24sIHsgcmVwbGFjZVN0YXRlOiB0cnVlIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgeyBwcm9wcywgYnJhbmNoIH0gPSBoeWRyYXRlZF90YXJnZXQ7XHJcbiAgICAgICAgICAgIHlpZWxkIHJlbmRlcihicmFuY2gsIHByb3BzLCBidWlsZFBhZ2VDb250ZXh0KHByb3BzLCBkZXN0LnBhZ2UpKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufVxyXG5mdW5jdGlvbiByZW5kZXIoYnJhbmNoLCBwcm9wcywgcGFnZSkge1xyXG4gICAgcmV0dXJuIF9fYXdhaXRlcih0aGlzLCB2b2lkIDAsIHZvaWQgMCwgZnVuY3Rpb24qICgpIHtcclxuICAgICAgICBzdG9yZXMucGFnZS5zZXQocGFnZSk7XHJcbiAgICAgICAgc3RvcmVzLnByZWxvYWRpbmcuc2V0KGZhbHNlKTtcclxuICAgICAgICBpZiAocm9vdF9jb21wb25lbnQpIHtcclxuICAgICAgICAgICAgcm9vdF9jb21wb25lbnQuJHNldChwcm9wcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBwcm9wcy5zdG9yZXMgPSB7XHJcbiAgICAgICAgICAgICAgICBwYWdlOiB7IHN1YnNjcmliZTogc3RvcmVzLnBhZ2Uuc3Vic2NyaWJlIH0sXHJcbiAgICAgICAgICAgICAgICBwcmVsb2FkaW5nOiB7IHN1YnNjcmliZTogc3RvcmVzLnByZWxvYWRpbmcuc3Vic2NyaWJlIH0sXHJcbiAgICAgICAgICAgICAgICBzZXNzaW9uOiBzdG9yZXMuc2Vzc2lvblxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBwcm9wcy5sZXZlbDAgPSB7XHJcbiAgICAgICAgICAgICAgICBwcm9wczogeWllbGQgcm9vdF9wcmVsb2FkZWRcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcHJvcHMubm90aWZ5ID0gc3RvcmVzLnBhZ2Uubm90aWZ5O1xyXG4gICAgICAgICAgICByb290X2NvbXBvbmVudCA9IG5ldyBBcHAoe1xyXG4gICAgICAgICAgICAgICAgdGFyZ2V0LFxyXG4gICAgICAgICAgICAgICAgcHJvcHMsXHJcbiAgICAgICAgICAgICAgICBoeWRyYXRlOiB0cnVlXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjdXJyZW50X2JyYW5jaCA9IGJyYW5jaDtcclxuICAgICAgICBjdXJyZW50X3F1ZXJ5ID0gSlNPTi5zdHJpbmdpZnkocGFnZS5xdWVyeSk7XHJcbiAgICAgICAgcmVhZHkgPSB0cnVlO1xyXG4gICAgICAgIHNlc3Npb25fZGlydHkgPSBmYWxzZTtcclxuICAgIH0pO1xyXG59XHJcbmZ1bmN0aW9uIHBhcnRfY2hhbmdlZChpLCBzZWdtZW50LCBtYXRjaCwgc3RyaW5naWZpZWRfcXVlcnkpIHtcclxuICAgIC8vIFRPRE8gb25seSBjaGVjayBxdWVyeSBzdHJpbmcgY2hhbmdlcyBmb3IgcHJlbG9hZCBmdW5jdGlvbnNcclxuICAgIC8vIHRoYXQgZG8gaW4gZmFjdCBkZXBlbmQgb24gaXQgKHVzaW5nIHN0YXRpYyBhbmFseXNpcyBvclxyXG4gICAgLy8gcnVudGltZSBpbnN0cnVtZW50YXRpb24pXHJcbiAgICBpZiAoc3RyaW5naWZpZWRfcXVlcnkgIT09IGN1cnJlbnRfcXVlcnkpXHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICBjb25zdCBwcmV2aW91cyA9IGN1cnJlbnRfYnJhbmNoW2ldO1xyXG4gICAgaWYgKCFwcmV2aW91cylcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAoc2VnbWVudCAhPT0gcHJldmlvdXMuc2VnbWVudClcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIGlmIChwcmV2aW91cy5tYXRjaCkge1xyXG4gICAgICAgIGlmIChKU09OLnN0cmluZ2lmeShwcmV2aW91cy5tYXRjaC5zbGljZSgxLCBpICsgMikpICE9PSBKU09OLnN0cmluZ2lmeShtYXRjaC5zbGljZSgxLCBpICsgMikpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5mdW5jdGlvbiBoeWRyYXRlX3RhcmdldChkZXN0KSB7XHJcbiAgICByZXR1cm4gX19hd2FpdGVyKHRoaXMsIHZvaWQgMCwgdm9pZCAwLCBmdW5jdGlvbiogKCkge1xyXG4gICAgICAgIGNvbnN0IHsgcm91dGUsIHBhZ2UgfSA9IGRlc3Q7XHJcbiAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBwYWdlLnBhdGguc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICAgICAgbGV0IHJlZGlyZWN0ID0gbnVsbDtcclxuICAgICAgICBjb25zdCBwcm9wcyA9IHsgZXJyb3I6IG51bGwsIHN0YXR1czogMjAwLCBzZWdtZW50czogW3NlZ21lbnRzWzBdXSB9O1xyXG4gICAgICAgIGNvbnN0IHByZWxvYWRfY29udGV4dCA9IHtcclxuICAgICAgICAgICAgZmV0Y2g6ICh1cmwsIG9wdHMpID0+IGZldGNoKHVybCwgb3B0cyksXHJcbiAgICAgICAgICAgIHJlZGlyZWN0OiAoc3RhdHVzQ29kZSwgbG9jYXRpb24pID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChyZWRpcmVjdCAmJiAocmVkaXJlY3Quc3RhdHVzQ29kZSAhPT0gc3RhdHVzQ29kZSB8fCByZWRpcmVjdC5sb2NhdGlvbiAhPT0gbG9jYXRpb24pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb25mbGljdGluZyByZWRpcmVjdHMnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJlZGlyZWN0ID0geyBzdGF0dXNDb2RlLCBsb2NhdGlvbiB9O1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBlcnJvcjogKHN0YXR1cywgZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIHByb3BzLmVycm9yID0gdHlwZW9mIGVycm9yID09PSAnc3RyaW5nJyA/IG5ldyBFcnJvcihlcnJvcikgOiBlcnJvcjtcclxuICAgICAgICAgICAgICAgIHByb3BzLnN0YXR1cyA9IHN0YXR1cztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgaWYgKCFyb290X3ByZWxvYWRlZCkge1xyXG4gICAgICAgICAgICBjb25zdCByb290X3ByZWxvYWQgPSByb290X2NvbXAucHJlbG9hZCB8fCAoKCkgPT4gKHt9KSk7XHJcbiAgICAgICAgICAgIHJvb3RfcHJlbG9hZGVkID0gaW5pdGlhbF9kYXRhLnByZWxvYWRlZFswXSB8fCByb290X3ByZWxvYWQuY2FsbChwcmVsb2FkX2NvbnRleHQsIHtcclxuICAgICAgICAgICAgICAgIGhvc3Q6IHBhZ2UuaG9zdCxcclxuICAgICAgICAgICAgICAgIHBhdGg6IHBhZ2UucGF0aCxcclxuICAgICAgICAgICAgICAgIHF1ZXJ5OiBwYWdlLnF1ZXJ5LFxyXG4gICAgICAgICAgICAgICAgcGFyYW1zOiB7fVxyXG4gICAgICAgICAgICB9LCAkc2Vzc2lvbik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxldCBicmFuY2g7XHJcbiAgICAgICAgbGV0IGwgPSAxO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHN0cmluZ2lmaWVkX3F1ZXJ5ID0gSlNPTi5zdHJpbmdpZnkocGFnZS5xdWVyeSk7XHJcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gcm91dGUucGF0dGVybi5leGVjKHBhZ2UucGF0aCk7XHJcbiAgICAgICAgICAgIGxldCBzZWdtZW50X2RpcnR5ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGJyYW5jaCA9IHlpZWxkIFByb21pc2UuYWxsKHJvdXRlLnBhcnRzLm1hcCgocGFydCwgaSkgPT4gX19hd2FpdGVyKHRoaXMsIHZvaWQgMCwgdm9pZCAwLCBmdW5jdGlvbiogKCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2VnbWVudCA9IHNlZ21lbnRzW2ldO1xyXG4gICAgICAgICAgICAgICAgaWYgKHBhcnRfY2hhbmdlZChpLCBzZWdtZW50LCBtYXRjaCwgc3RyaW5naWZpZWRfcXVlcnkpKVxyXG4gICAgICAgICAgICAgICAgICAgIHNlZ21lbnRfZGlydHkgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgcHJvcHMuc2VnbWVudHNbbF0gPSBzZWdtZW50c1tpICsgMV07IC8vIFRPRE8gbWFrZSB0aGlzIGxlc3MgY29uZnVzaW5nXHJcbiAgICAgICAgICAgICAgICBpZiAoIXBhcnQpXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc2VnbWVudCB9O1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaiA9IGwrKztcclxuICAgICAgICAgICAgICAgIGlmICghc2Vzc2lvbl9kaXJ0eSAmJiAhc2VnbWVudF9kaXJ0eSAmJiBjdXJyZW50X2JyYW5jaFtpXSAmJiBjdXJyZW50X2JyYW5jaFtpXS5wYXJ0ID09PSBwYXJ0LmkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VycmVudF9icmFuY2hbaV07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBzZWdtZW50X2RpcnR5ID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB7IGRlZmF1bHQ6IGNvbXBvbmVudCwgcHJlbG9hZCB9ID0geWllbGQgY29tcG9uZW50c1twYXJ0LmldLmpzKCk7XHJcbiAgICAgICAgICAgICAgICBsZXQgcHJlbG9hZGVkO1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlYWR5IHx8ICFpbml0aWFsX2RhdGEucHJlbG9hZGVkW2kgKyAxXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHByZWxvYWRlZCA9IHByZWxvYWRcclxuICAgICAgICAgICAgICAgICAgICAgICAgPyB5aWVsZCBwcmVsb2FkLmNhbGwocHJlbG9hZF9jb250ZXh0LCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBob3N0OiBwYWdlLmhvc3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBwYWdlLnBhdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBxdWVyeTogcGFnZS5xdWVyeSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtczogcGFydC5wYXJhbXMgPyBwYXJ0LnBhcmFtcyhkZXN0Lm1hdGNoKSA6IHt9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sICRzZXNzaW9uKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHt9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJlbG9hZGVkID0gaW5pdGlhbF9kYXRhLnByZWxvYWRlZFtpICsgMV07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gKHByb3BzW2BsZXZlbCR7an1gXSA9IHsgY29tcG9uZW50LCBwcm9wczogcHJlbG9hZGVkLCBzZWdtZW50LCBtYXRjaCwgcGFydDogcGFydC5pIH0pO1xyXG4gICAgICAgICAgICB9KSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgcHJvcHMuZXJyb3IgPSBlcnJvcjtcclxuICAgICAgICAgICAgcHJvcHMuc3RhdHVzID0gNTAwO1xyXG4gICAgICAgICAgICBicmFuY2ggPSBbXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHsgcmVkaXJlY3QsIHByb3BzLCBicmFuY2ggfTtcclxuICAgIH0pO1xyXG59XG5cbmZ1bmN0aW9uIHByZWZldGNoUm91dGVzKHBhdGhuYW1lcykge1xyXG4gICAgcmV0dXJuIHJvdXRlc1xyXG4gICAgICAgIC5maWx0ZXIocGF0aG5hbWVzXHJcbiAgICAgICAgPyByb3V0ZSA9PiBwYXRobmFtZXMuc29tZShwYXRobmFtZSA9PiByb3V0ZS5wYXR0ZXJuLnRlc3QocGF0aG5hbWUpKVxyXG4gICAgICAgIDogKCkgPT4gdHJ1ZSlcclxuICAgICAgICAucmVkdWNlKChwcm9taXNlLCByb3V0ZSkgPT4gcHJvbWlzZS50aGVuKCgpID0+IHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwocm91dGUucGFydHMubWFwKHBhcnQgPT4gcGFydCAmJiBjb21wb25lbnRzW3BhcnQuaV0uanMoKSkpO1xyXG4gICAgfSksIFByb21pc2UucmVzb2x2ZSgpKTtcclxufVxuXG5jb25zdCBzdG9yZXMkMSA9ICgpID0+IGdldENvbnRleHQoQ09OVEVYVF9LRVkpO1xuXG5leHBvcnQgeyBnb3RvLCBwcmVmZXRjaCwgcHJlZmV0Y2hSb3V0ZXMsIHN0YXJ0JDEgYXMgc3RhcnQsIHN0b3JlcyQxIGFzIHN0b3JlcyB9O1xuIiwiaW1wb3J0ICogYXMgc2FwcGVyIGZyb20gJ0BzYXBwZXIvYXBwJztcblxuc2FwcGVyLnN0YXJ0KHtcblx0dGFyZ2V0OiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjc2FwcGVyJylcbn0pOyJdLCJuYW1lcyI6WyJpbml0IiwiRXJyb3JDb21wb25lbnQiLCJyb290X2NvbXAucHJlbG9hZCIsInNhcHBlci5zdGFydCJdLCJtYXBwaW5ncyI6IkFBQUEsU0FBUyxJQUFJLEdBQUcsR0FBRztBQUVuQixTQUFTLE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFO0FBQzFCO0FBQ0EsSUFBSSxLQUFLLE1BQU0sQ0FBQyxJQUFJLEdBQUc7QUFDdkIsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hCLElBQUksT0FBTyxHQUFHLENBQUM7QUFDZixDQUFDO0FBSUQsU0FBUyxZQUFZLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtBQUN6RCxJQUFJLE9BQU8sQ0FBQyxhQUFhLEdBQUc7QUFDNUIsUUFBUSxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7QUFDekMsS0FBSyxDQUFDO0FBQ04sQ0FBQztBQUNELFNBQVMsR0FBRyxDQUFDLEVBQUUsRUFBRTtBQUNqQixJQUFJLE9BQU8sRUFBRSxFQUFFLENBQUM7QUFDaEIsQ0FBQztBQUNELFNBQVMsWUFBWSxHQUFHO0FBQ3hCLElBQUksT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9CLENBQUM7QUFDRCxTQUFTLE9BQU8sQ0FBQyxHQUFHLEVBQUU7QUFDdEIsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3JCLENBQUM7QUFDRCxTQUFTLFdBQVcsQ0FBQyxLQUFLLEVBQUU7QUFDNUIsSUFBSSxPQUFPLE9BQU8sS0FBSyxLQUFLLFVBQVUsQ0FBQztBQUN2QyxDQUFDO0FBQ0QsU0FBUyxjQUFjLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtBQUM5QixJQUFJLE9B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
