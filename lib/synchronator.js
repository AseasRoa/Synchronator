// 1) == The main constructor ==========================================================================================

/**
 * The Synchronator construcor. It is similar to Promise, but very basic and so much faster.
 * Few other necessary functions are bundled with the constructor.
 * @param synchronatorFunction
 * @constructor
 */
const Synchronator = function(synchronatorFunction) {
	this.synchronatorFunction = synchronatorFunction
}

Synchronator.prototype.then = function(resolve, reject) {
	this.synchronatorFunction(resolve, reject)
}

// 2) == Functions to be added to the constructor ======================================================================

/**
 * Private function used to deal with inerator errors
 * @param iterator
 * @param error
 * @private
 */
Synchronator._callThrowFn = function(iterator, error)
{
	try
	{
		iterator.throw(error)
	}
	catch(e)
	{
		console.error(e.stack)
	}
}

/**
 * This function is used for functions who have callback and are marked like this: fname(arg1, {})
 * @param fn
 * @returns {Synchronator}
 * @constructor
 */
Synchronator.CallbackCatcher = function(fn) {
	var ctx = this

	return new Synchronator(function(resolve) {

		fn.call(ctx, function() {
			var length = arguments.length

			if (length === 0)
			{
				resolve(undefined)
			}
			else if (length === 1)
			{
				resolve(arguments[0])
			}
			else
			{
				var i = 0

				// find the first
				for (i = 0; i < length; i++)
				{
					if (arguments[i])
					{
						resolve(arguments[i])

						return
					}
				}

				resolve(arguments[i])
			}
		})
	})
}

// When we have chained functions, we pass this function via Object
Object.defineProperty(
		Object.prototype,
		"SynchronatorCallbackCatcher",
		{
			enumerable : false,
			writable   : true,
			value      : Synchronator.CallbackCatcher
		}
)

/**
 * Resolves Generator function that contains Synchronator/Promise/Thunk functions in it.
 * Each JavaScript function that would run in synchronous manner is wrapped with Synchronator.runGenerator()
 * @param generator
 * @returns {Function}
 */
Synchronator.runGenerator = function(generator)
{
	return function synchronatorResolveHelper()
	{
		//**
		//
		// This function wraps your original function and must be run with Synchronator.
		//
		//**

		var iterator   = generator.apply(this, arguments)
		var iterations = 0

		return new Synchronator(function(resolve, reject) {
			//var callNext  = next.bind(null, "next")
			//var callThrow = next.bind(null, "throw")
			var callThrow = Synchronator._callThrowFn.bind(null, iterator)

			function callNext(arg)
			{
				try
				{
					var result = iterator.next(arg)
					var value  = result.value
				}
				catch (e)
				{
					console.error(e.stack)

					return
				}

				//**
				// Iterations counter is used to prevent "Maximum call stack size exceeded"
				// http://stackoverflow.com/questions/20936486/node-js-maximum-call-stack-size-exceeded
				//**

				iterations++

				if (result.done)
				{
					if (value instanceof Synchronator || value instanceof Promise)
					{
						if ("value" in value)
						{
							// the function returned syncronously
							callNext(value['value'])
						}
						else
						{
							resolve(value)
						}
					}
					else
					{
						if (typeof resolve === "function") resolve(value)
					}
				}
				else
				{
					if (iterations > 99)
					{
						iterations = 0

						if (value instanceof Synchronator || value instanceof Promise)
						{
							if ("value" in value)
							{
								// the function returned syncronously
								process.nextTick(function() {callNext(value['value'])})
							}
							else
							{
								process.nextTick(function() {value.then(callNext, callThrow)})
							}
						}
						else
						{
							process.nextTick(function() {callNext(value)})
						}
					}
					else
					{
						if (value instanceof Synchronator || value instanceof Promise)
						{
							if ("value" in value)
							{
								// the function returned syncronously
								callNext(value['value'])
							}
							else
							{
								value.then(callNext, callThrow)
							}
						}
						else
						{
							if (0)
							{
								// TODO make this to work with thunk functions
								if (typeof value === "function")
								{
									value(function(err, data) {callNext(data)})
								}
								else
								{
									callNext(value)
								}
							}
							else
							{
								callNext(value)
							}
						}
					}
				}
			}

			callNext()
		})
	}
}

// 3) == Export ========================================================================================================
if (typeof module !== 'undefined')
{
	module.exports = Synchronator
}