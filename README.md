# Synchronator - PHP-like synchronous code in NodeJS

# What is it?

Synchronator is a modules manager where the code in each module can look synchronous and still work asynchronously. There is no callback hell, no Promise hell, no Async-Await hell.

# Why?

Because in NodeJS we don't really need to have asynchronous looking code. Yes, JavaScript is asynchronous by nature, which is because of the way we interact with the browser. But on the server we don't have mouse clicks and DOM elements to be changed, most of the time we just interact with the database and generate strings (HTML, JSON, XML...). Although there are different solutions for the callback hell, the fact is that they still require bunch ot extra code to be written. The problem is not solved, it is only replaced with another problem.

# What is the solution?

Instead of doing this...
```javascript
function fnOne(input, callback) {
	fnTwo(input, (err, data) => {
		if (err) {
			console.error("Error happened in fnOne");
		}
		else {
			callback(data);
		}
	})
}
```
We can do this...
```javascript
function fnOne * (input) {
	var data = fnTwo(input);

	if (data instanceof Error) {
		console.error("Error happened in fnOne");
	}
	else {
		return data;
	}
}
```

The only extra code is that * symbol that is used to mark the function. You might recognize this symbol from the Generator functions and this is fact a Generator function, but there is no need to write "yield" keywords in it. The function can return either the desired result or an Error object and the only extra words to check that are "instanceof Error".

# How to install?

```npm install synchronator```

# How it works under the hood?

Imagine a CommonJS module - a file with JS code with some "require()" on the top and "module.exports" on the bottom. Synchronator reads this file, adds some extra code in it, writes the changes in another file (in the Temp folder) and the program runs from that file. In all modules loaded using Synchronator the native "require()" function is replaced with another "require()" function that does the magic stuff. You only need to load one initial module.

Synchronator is some sort of a pre-processor, or a transpiler. It writes the ugly code for you, so that you don't have to do it. It then loads those modules in it's own context and runs the code from them.

What is the ugly code? Mostly Generator functions filled with "yield" keywords, wrapped with Synchronator functions. You see, we already have those Generator function in JavaScript that allow us to write code that looks truly synchronous, but it is very complex to use them. Not only that, but we must use many "yield" keywords in them, which is annoying. I found out that in a Generator function you can prepend any function calls with "yield" and everything still works very well. So this is what Synchronator does - it prepends ALL function calls with "yield" keywords.

Let's see some example that shows how Synchronator works under the hood. This is how our initial code looks like:

```javascript
var fn1 = function*(time)
{
	var result = sleep(time)

	return result
})

var fn2 = function*()
{
	var result = fn1(1000)

	return result
})
```

Now this is how it looks like after the transformation:

```javascript
var sleep = function(time) {
	return new Synchronator(function (resolve, reject) {
		setTimeout(() => {resolve(time + "ms timed out")}, time)
	})
}

var fn1 = Synchronator.runGenerator(function*(time)
{
	var result = (yield sleep(time))

	return result
})

var fn2 = Synchronator.runGenerator(function*()
{
	var result = (yield fn1(1000))

	return result
})
```

Let's add some comments and extra code to see how this code is actually used. You can find this code in the examples.

```javascript
var Synchronator = require("synchronator")

/**
 * Start with a function that returns either Promise or Synchronator object
 */
var sleep = function(time) {
	return new Synchronator(function(resolve) {
		setTimeout(() => {resolve("Sleeping for " + time + " milliseconds")}, time)
	})
}

/**
 * "fn1" will be a special function (similar to "sleep") that can be run in another Generator controlled by Synchronator
 * (see "fn2" below)
 */
var fn1 = Synchronator.runGenerator(function*(time)
{
	var result = yield sleep(time)

	return result
})

/**
 * "fn2" is the same kind of function as "fn1" and we can run "fn1" in "fn2"
 */
var fn2 = Synchronator.runGenerator(function*()
{
	var result = yield fn1(1000)

	return result
})

/**
 * "fn2()" returns Synchronator object, so then we need to use "then" to get the result
 */
fn2().then(function (result) {
	console.log(result)
})
```

Synchronator.runGenerator is just a function that does the iteration job in the Generator function. It returns a function that is very similar to the native Promise, but much more basic.
As you can see, only those function with the **\*** symbol are touched. Any normal function is left as is.

# How to start using it?

You need to load a module with Synchronator.require() and process the exports. A special "require()" function is injected into this module. When you do "require()" for another sub-module, it is injected in it as well. Unless the required module belongs to NodeJS of course.

```javascript
// "Synchronator" is already put in the global scope when the module is required and because of that
// "var Synchronator = " is not mandatory here, but we don't want to hurt someone's feelings
var Synchronator = require("synchronator")

// Get the module using require() from Synchronator
var startModule = Synchronator.require(__dirname + "/modules/startModule.js")

// "module1" is now an instance of Synchronator, so let's apply "then" to it
startModule.then((exports) => {
	// we loaded the module and we got the exports, now decide what to do with them
	if (typeof exports === "function")
	{
		// we may want to pass some argument to the function
		var someInputArgument = "\nHello, Synchronator!"

		// let's run the function
		var result = exports(someInputArgument)

		// and process the result
		if (result instanceof Synchronator)
		{
			result.then((value) =>
			{
				console.log(value)
			})
		}
		else
		{
			// do something here if the function is not a Synchronator function
		}
	}
	else
	{
		// do something here if the module exports an object, string ot whatever...
	}
})
```

This is the **example-modules** example in **/examples**. Try it!

# What about regular calback functions?
Do them like that:

```javascript
myCallBackFunction(myArgumentsList, (0));
```

The key is that (0) as a final argument. It basically means nothing, I just decided to use this as a keyword that tells Synchronator that this is a normal callback function. It will then wrap it with another special function and deal with it. The returned value is pretty much the first non-negative parameter in the actual callback function, so it would choose to return the error or the desired value.

# new Synchronator() vs new Promise()
In functions marked with **\*** you can use functions that return Promise as well. In the examples above you can see that **new Synchronator()** was used in the example **sleep** function, but it will work with **new Promise()** as well.

**Synchronator.runGenerator()** is designed to take the Generator functions (from the transformed code) and to do all the **yield** iterations in them. In the standard JavaScript you should have Promise function right after each **yield** keyword, but here you can also have Synchronator functions (made with **new Synchronator()** instead of **new Promise()**). Not only that, but promises are actually much slower, because **new Synchronator()** is very lightweight analog of **new Promise()**.

However, **new Synchronator()** cannot fully replace **new Promise()**, it is not a substitute.

# You know that we can already use async-await, right?
That's true and it's all fine with the keyword **async**, but I still don't like the presence of another keyword - **await**. Yes, even this is too much for me. That's why Synchronator adds all the special keywords for me. I only need to mark certain functions with **\***... and I'm thinking about removing this as well.

# How fast is it?
I was thinking, how fast is the execution of **\*** functions compared to async-await? In **/test** you can find 2 benchmarks - **benchmark-synchronator** and **benchmark-async**. On my PC, Synchronator is about 2 times faster!

# Does this work on the browser?
In my production website I also use Synchronator on the broswer side. But to be honest, I think that I probably don't need it so much over there. Maybe for Ajax requests or something like that, but at the moment I don't have very much to show. I'm still experimenting.
