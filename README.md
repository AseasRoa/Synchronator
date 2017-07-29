# Synchronator - PHP-like synchronous code in NodeJS

# A little bit of history

When I decided to rewrite my project from PHP to NodeJS, I thought that converting some functions from synchronous to asynchronous would not be such a big deal, but I quickly realized that this is not the case. My PHP code was already ugly and I did not want to make it worse, so I decided to find a solution. I knew there were many ways to make JavaScript code to look more synchronous - Promise, Generators and all kind of modules - but neither of them makes the code 100% synchronous. I wanted 100% synchronous code, so I wrote this tool for me.

I did this module for my custom NodeJS framework and it helps me a lot!

By the way, Syncronator is Terminator for asynchronous code :D

# The problem in NodeJS

Writing asynchronous code in NodeJS creates a mess. But in NodeJS we don't have the same kind of events like in JavaScript (in browsers). We don't use out mouse or keyboard to interact with NodeJS. We use asynchronous functions in NodeJS mostly to prevent it from blocking. We don't want to block the whole application while reading a file for example, but in PHP we are used to read a file in one row of code without having blocking issues. PHP is of course much more intuitive, but can we do the same in NodeJS?

Yes, we can write fully synchronous code in NodeJS and still using asynchronous functions! And we don't need Promise or anything else that adds extra code. We can do that by translating out synchronous code into asynchronous in background.

Instead of doing this...
```
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
```
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

First of all, it doesn't work directly out of the box, some preparations are needed. It is a pre-processor (or transpiler), similar to LESS, SASS or Stylus for CSS or Babel for JavaScript. The idea is that your original code needs to be turned to another code, which is then used in the project. Synchronator contains function to transform the input code into Synchronator-compatible code. It also contains function to run that code.

Let's start with an example that shows how everything works:

```
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
This code magically works, but it is still ugly, because of these "Synchronator.runGenerator" and "yield" words in it. We can extract the fn1-fn2 part of this code and write it like this:
```
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

I decided to use the **\*** symbol to mark the synchronous functions. This symbol is normally used for Generator functions, so the IDE does not complain at all. In fact, all Synchronator functions are actually Generator functions in which the **yield** keyword is automatically added.

... to be continued...
