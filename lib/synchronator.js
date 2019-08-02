// 1) == The main constructor ==========================================================================================

/**
 * The Synchronator constructor. It is similar to Promise, but very basic and so much faster.
 * Few other necessary functions are bundled with the constructor.
 * @param synchronatorFunction
 * @constructor
 */
/*
// This is the old Synchronator that is simpler,
// but does not run the function immediately and requires then() to be used

const Synchronator = function(synchronatorFunction) {
	this.synchronatorFunction = synchronatorFunction
}

Synchronator.prototype.then = function(resolve, reject) {
	this.synchronatorFunction(resolve, reject)
}
*/

const Synchronator = function(promiseFunction) {
	this.promiseFunction = promiseFunction
	this.state = 0
	this.val = null // do not call this 'value', because it is overwritten by 'result.value' of the generator
	this.cb = function() {}

	var that = this

	this.resolve = function(val) {
		that.val = val
		that.state = 1

		that.cb(val)
	}
	this.resolve.default = true // indicates that this is the function above, which is the default one

	this.promiseFunction(this.resolve, this.resolve)
}

Synchronator.prototype.then = function(resolve, reject) {
	if (this.state === 1)
	{
		resolve(this.val)
	}
	else
	{
		this.cb = resolve
	}
}

// 2) == Functions to be added to the constructor ======================================================================

/**
 * Private function used to deal with iterator errors
 * @param iterator
 * @param {Error} error
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
 * @param {function} fn
 * @returns {Synchronator}
 * @constructor
 */
Synchronator.CallbackCatcher = function(fn) {
	var ctx = this
	var original_fn = null

	return new Synchronator(function(resolve) {
		var options = {}

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
			else if (length === 2 && arguments[0] === null)
			{
				resolve(arguments[1])
			}
			else if (length > 0 && arguments[0] instanceof Error)
			{
				resolve(arguments[0])
			}
			else
			{
				resolve(arguments)
			}
		}, options)
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
	var retval = function synchronatorResolveHelper()
	{
		//**
		//
		// This function wraps your original function and must be run with Synchronator.
		//
		//**

		var iterator   = generator.apply(this, arguments)
		var iterations = 0

		return new Synchronator(function(resolve, reject)
		{
			//var callNext  = next.bind(null, "next")
			//var callThrow = next.bind(null, "throw")
			//var callThrow = Synchronator._callThrowFn.bind(null, iterator)

			function callNext(arg)
			{
				var result, value

				if (typeof reject === "function")
				{
					try
					{
						result = iterator.next(arg)
						value  = result.value
					}
					catch (e)
					{
						if (typeof reject === "function" && !(reject.default)) reject(e)
						else console.error(e.stack)

						return
					}
				}
				else
				{
					result = iterator.next(arg)
					value  = result.value
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
								process.nextTick(function() {value.then(callNext)})
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
								value.then(callNext)
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

	retval.generator = generator

	return retval
}

// 3) == Export ========================================================================================================
if (typeof module !== 'undefined')
{
	module.exports = Synchronator
}