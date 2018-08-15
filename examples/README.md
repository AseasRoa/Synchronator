# Usage of Synchronator for modules
```node example-modules```

Shows how to run the show. We have one module (startModule.js) that is the initial module from which we can load other modules. The key is to properly run the initial module and after that all sub-modules take care of themselves.

# Low level example of how Synchronator works under the hood
```node example-under-the-hood```

Shows how Synchronator works at low level. Check this only if you are interested, this is not a "How to" example.

# Usage of Synchronator.transform()
```node example-transform```

Shows the output of Synchronator.transform(), which is used to transform the input code into Synchronator-ready code. Again, try this only if you want to see what is going on on low level.

# Benchmark: Synchronator vs Async-Await
```node benchmark```

Benchmarks the speed of calling functions using Async-Awayt vs Synchronator.