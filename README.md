# Synchronator - PHP-like synchronous code in NodeJS

# Before you start
I wrote this tool for my own custom framework and I'm happy with it, I currently use it in production. But I can't give any guarantees to other people. Use it at your own risk!

This module is intended to be used in some kind of framework, it must be prepared before use. Then it allows you to require modules in pretty much the same way as you are doing it now in NodeJS, but these modules are executed through Synchronator. Bugs and problems are expected. Don't blame me if something doesn't work for you, but please tell me about it :)

# A little bit of history

When I decided to rewrite my project from PHP to NodeJS, I thought that converting some functions from synchronous to asynchronous would not be such a big deal, but I quickly realized that this is not the case. My PHP code was already ugly and I did not want to make it worse, so I decided to find a solution. I knew that there are many ways to make JavaScript code to look more synchronous - Promise, Generators and all kind of modules - but neither of them makes the code 100% synchronous. I wanted 100% synchronous code, just like in PHP, so I wrote this tool to do exactly that.

I did this module for my custom NodeJS framework and it helps me a lot!

By the way, Syncronator means Terminator for asynchronous code :D

# Do we really need asynchronous functions in NodeJS? Not really...

Writing asynchronous code in NodeJS creates a mess. But in NodeJS we don't have the same kind of events like in JavaScript (in browsers) - we don't use out mouse or keyboard to interact with NodeJS. We use asynchronous functions in NodeJS mostly to prevent JavaScript from blocking. For example, we can use **fs.readFileSync()** in NodeJS to read a file, but we don't want to block the whole application while doing that, right? After all, in PHP we are used to read a file in one row of code without any blocking issues.

I can tell you now that we can write fully synchronous code in NodeJS and still using asynchronous functions! And we don't need Promise or anything else that still adds extra code that we don't like. We can do that by automatically translating out synchronous code into asynchronous in background.

Instead of doing this...
```javascript
function fnOne(input, callback) {
  fnTwo(input, (err, data) => {
    if (err) {
      console.error("Error happened in asyncFuncOne");
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
    console.error("Error happened in asyncFuncOne");
  }
  else {
    return data;
  }
}
```

# How to install?

```npm install synchronator```

# How it works?

First of all, Synchronator doesn't work directly out of the box, some preparations are needed. It is a pre-processor (or transpiler), similar to LESS, SASS or Stylus for CSS or Babel for JavaScript, or TypeScript for JavaScript. The idea is that your original code needs to be turned to another code, which is then executed.

Synchronator contains a function to transform the input synchronous code into output asynchronous code that then needs to be run with another Synchronator function.

But let's start with an example that shows how everything works under the hood:

```javascript
var Synchronator = require("synchronator")

/**
 * Start with a function that returns either Promise or Synchronator object
 */
var sleep = function(time) {
	return new Synchronator(function (resolve, reject) {
		setTimeout(() => {resolve(time + "ms timed out")}, time)
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

This code magically works, but it is still ugly, because of these **Synchronator.runGenerator** and **yield** words in it. Let's strip all the ugliness. Now we have this:
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

See this **\*** symbol? Yes, in JavaScript this symbol turns the function into Generator, but here we are using the same symbol to mark our synchronous functions. This code wound not work properly in JavaScript, but if we somehow add the ugly stuff from the previous example, it will work. This is the idea - we can write beautiful code like that and let Synchronator deal with all the necessary ugliness in background.

Now we can get this code, run it through **Synchronator.transform()** and get our asynchronous code. For this you can try the **example-transform** example in **/test**.

Now we have pure Generator functions wrapped in some **Synchronator.runGenerator** stuff. This code needs to be executed somehow.

# Here comes the modified **require()** function
We are now talking for CommonJS modules. Synchronator comes with modified **require()** function that can be used to load modules in pretty much the same old way. But in addition, that **require()** function contains **Synchronator.transform()** in itself and the required modules are automatically handled by Synchronator.

So, you can start with something like this:

```javascript
//== "Synchronator" is already put in "global" when the module is required
require("synchronator")

//== get the module using require() from Synchronator
var module1 = Synchronator.require(__dirname + "/modules/module1.js")

//== "module1" now contains a function that will return Synchronator object when we call it
if (typeof module1 == "function")
{
	module1().then((value) =>
	{
		console.log(value)
	})
}
```
This is the **example-modules** example in **/test**. Try it!

Now **module1.js** can contain that beautiful synchronous code. And if we use **require("./module2")** we can just automatically get the exports from module2.js.
