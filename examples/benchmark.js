//==================================================================================================================//
//== This example benchmarks the speed of calling functions using Synchronator compared to the native Async-Await ==/
//==================================================================================================================//

var Synchronator = require("synchronator")

//==== The asynchronous functions used for the benchmark ====//

var testFuncP = function()
{
	return new Promise(function (resolve, reject) {
		resolve("Async-Await Benchmark")
	})
}

var testFuncS = function()
{
	return new Synchronator(function (resolve, reject) {
		resolve("Synchronator Benchmark")
	})
}

//===== Async-Await functons =====//
async function asyncRun()
{
	var result

	for (var i = 1; i <= 10; i++)
	{
		result = await testFuncP(i)
	}

	return result
}

async function asyncStart()
{
	// run another "async" function million times
	var result

	for (var i = 1; i <= 1000000; i++)
	{
		result = await asyncRun(i)
	}

	return result
}

//===== Synchronator functions =====//
var synchronatorRun = Synchronator.runGenerator(function*()
{
	var result

	for (var i = 1; i <= 10; i++)
	{
		result = yield testFuncS(i)
	}

	return result
})

var synchronatorStart = Synchronator.runGenerator(function*()
{
	// run another Synchronator function million times
	var result

	for (var i = 1; i <= 1000000; i++)
	{
	   result = yield synchronatorRun(i)
	}

	return result
})

//===== Start benchmarking =====//

// 1) Benchmark Async-Await
var label = "Async-Await Speed"

console.time(label)

asyncStart().then(function(result)
{
	console.timeEnd(label)

	// 2) Bnechmark Synchronator
	label = "Synchronator Speed"
	console.time(label)

	synchronatorStart().then(function(result)
	{
		console.timeEnd(label)
	})
})