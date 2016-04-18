Yet another implementation of Fortune's sweepline algorithm for Voronoi diagram. This is an O(nlogn) algorithm based on [Ivan Kuckir](http://blog.ivank.net/fortunes-algorithm-and-implementation.html) implementation, but more optimized (for example, using a Fibonacci heap instead of a sorted array for the priority queue).

This implementation has not been tested thoroughly and should not be use in production settings. We recommend using instead [Raymond Hill's implementation](https://github.com/gorhill/Javascript-Voronoi/blob/master/LICENSE.md).

## Demo
http://bathlamos.github.io/voronoi/

## Usage
Given a array of 2D points, which are themselves arrays, we can create a Voronoi diagram.
```
var points = [
                [-1.5, 0],
                [0, 1],
                [0, 10],
                [1.5, 0]
              ];

var diagram = Voronoi.compute(points);

/*
 The result is
 diagram = {
     edges : [...], ~ The set of all Voronoi edges
     cells : [...]  ~ The set of all Voronoi cells
   }
 */
```
