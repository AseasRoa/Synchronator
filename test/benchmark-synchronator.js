//=============================================================================//
//== This example benchmarks the speed of calling functions with Synchronator ==/
//=============================================================================//

var Synchronator = require("synchronator")

// Few functions used for the benchmark

var testFunc = function()
{
	return new Synchronator(function (resolve, reject) {
		resolve("Synchronator Benchmark")
	})
}

var fn1 = Synchronator.runGenerator(function*()
{
	// wait for the asynchronous function 3 times
	var result = yield testFunc()
	var result = yield testFunc()
	var result = yield testFunc()

	return result
})

var fn2 = Synchronator.runGenerator(function*()
{
	// run another Synchronator function million times
	var result

	for (var i = 0; i < 1000000; i++)
	{
	   result = yield fn1()
	}

	return result
})

// Start benchmarking

console.time("Speed")

fn2().then(function(result)
{
	console.log(result)
	console.timeEnd("Speed")
})