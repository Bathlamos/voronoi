/*
 (c) 2016, Philippe Legault
 An implementation of Fortune's sweepline O(nlogn) algorithm for Voronoi
 https://github.com/Bathlamos/voronoi
 */

(function () {

    var Voronoi = {
        compute: function (points, width, height) {
            if (points.length < 2)
                return [];

            // Parameters for method calls
            var options = {
                edges: [],
                firstPoint: null,
                heap: new FibonacciHeap(),
                height: height,
                root: null,
                sweeplineY: 0
            };

            var cells = [];
            for (var i = 0; i < points.length; i++) {
                var cell = new Polygon();
                points[i].cell = cell;
                options.heap.insert(-points[i][1], points[i]);
                cells.push(cell);
            }

            while (!options.heap.isEmpty()) {
                var e = options.heap.extractMinimum().value;
                if (e instanceof CircleEvent) {
                    options.sweeplineY = e.point[1];
                    removeParabola(e, options);
                } else {
                    options.sweeplineY = e[1];
                    insertParabola(e, options);
                }
            }
            finishEdge(options.root, width);

            for (i = 0; i < options.edges.length; i++)
                if (options.edges[i].neighbour)
                    options.edges[i].start = options.edges[i].neighbour.end;

            return {
                edges: options.edges,
                cells: cells
            };
        }
    };

    function insertParabola(p, options) {
        if (!options.root) {
            options.root = new Parabola(p);
            options.firstPoint = p;
            return;
        }

        // degenerate case - the first two points at the same height
        if (options.root.isLeaf && options.root.site[1] - p[1] < 0.01) {
            options.root.isLeaf = false;
            options.root.left = new Parabola(options.firstPoint);
            options.root.right = new Parabola(p);
            var s = [(p[0] + options.firstPoint[0]) / 2, options.height];
            if (p[0] > options.firstPoint[0])
                options.root.edge = new Edge(s, options.firstPoint, p);
            else
                options.root.edge = new Edge(s, p, options.firstPoint);
            options.edges.push(options.root.edge);
            return;
        }

        // The arc under point p
        var par = getParabolaByX(p[0], options.root, options.sweeplineY);

        // If the parabola has a circle event (i.e. an arc is "squeezed" out of existence by two neighbor arcs)
        // then remove that event from the queue, because the parabola is being split
        if (par.circleEventHeapNode) {
            options.heap.delete(par.circleEventHeapNode);
            par.circleEventHeapNode = null;
        }

        // Find the start of new Voronoi edges
        var start = [p[0], getY(par.site, p[0], options.sweeplineY)];

        var el = new Edge(start, par.site, p);
        var er = new Edge(start, p, par.site);

        el.neighbour = er;
        options.edges.push(el);

        par.edge = er;
        par.isLeaf = false;

        // Split the original parabola in three
        var p0 = new Parabola(par.site);
        var p1 = new Parabola(p);
        var p2 = new Parabola(par.site);

        par.right = p2;
        par.left = new Parabola();
        par.left.edge = el;

        par.left.left = p0;
        par.left.right = p1;

        // Check for the new circle events
        computeCircleEvents(p0, options.sweeplineY, options.heap);
        computeCircleEvents(p2, options.sweeplineY, options.heap);
    }

    function removeParabola(e, options){
        var p1 = e.arch;

        var xl = getLeftParent(p1);
        var xr = getRightParent(p1);

        // Left and right parabolas
        var p0 = getLeftChild(xl);
        var p2 = getRightChild(xr);

        // Delete circle events for the neighbor parabolas
        if (p0.circleEventHeapNode) {
            options.heap.delete(p0.circleEventHeapNode);
            p0.circleEventHeapNode = null;
        }
        if (p2.circleEventHeapNode) {
            options.heap.delete(p2.circleEventHeapNode);
            p2.circleEventHeapNode = null;
        }

        var p = [e.point[0], getY(p1.site, e.point[0], options.sweeplineY)];

        if (p0.site.cell.last == p1.site.cell.first)
            p1.site.cell.addLeft(p);
        else
            p1.site.cell.addRight(p);

        p0.site.cell.addRight(p);
        p2.site.cell.addLeft(p);

        xl.edge.end = p;
        xr.edge.end = p;

        var higher;
        var par = p1;
        while (par != options.root) {
            par = par.parent;
            if (par == xl)
                higher = xl;
            if (par == xr)
                higher = xr;
        }

        higher.edge = new Edge(p, p0.site, p2.site);

        options.edges.push(higher.edge);

        var gparent = p1.parent.parent;
        if (p1.parent.left === p1) {
            if (gparent.left === p1.parent)
                gparent.left = p1.parent.right;
            else
                p1.parent.parent.right = p1.parent.right;
        }
        else {
            if (gparent.left === p1.parent)
                gparent.left = p1.parent.left;
            else
                gparent.right = p1.parent.left;
        }

        // Check for the new circle events
        computeCircleEvents(p0, options.sweeplineY, options.heap);
        computeCircleEvents(p2, options.sweeplineY, options.heap)
    }

    /**
     * Cuts the edges in the tree the size of the given width and height
     * @param n A node in the tree
     * @param width The desired width
     */
    function finishEdge(n, width) {
        var mx;
        if (n.edge.direction[0] > 0.0)
            mx = Math.max(width, n.edge.start[0] + 10);
        else
            mx = Math.min(0.0, n.edge.start[0] - 10);
        n.edge.end = [mx, n.edge.f * mx + n.edge.g];

        if (!n.left.isLeaf)
            finishEdge(n.left, width);
        if (!n.right.isLeaf)
            finishEdge(n.right, width);
    }

    function getXOfEdge (par, y) { // calculates the intersection of the parabolas at that node
        var left = getLeftChild(par);
        var right = getRightChild(par);

        var p = left.site;
        var r = right.site;

        var dp = 2 * (p[1] - y);
        var a1 = 1 / dp;
        var b1 = -2 * p[0] / dp;
        var c1 = y + dp * 0.25 + p[0] * p[0] / dp;

        dp = 2 * (r[1] - y);
        var a2 = 1 / dp;
        var b2 = -2 * r[0] / dp;
        var c2 = y + dp * 0.25 + r[0] * r[0] / dp;

        var a = a1 - a2;
        var b = b1 - b2;
        var c = c1 - c2;

        var disc = b * b - 4 * a * c;
        var x1 = (-b + Math.sqrt(disc)) / (2 * a);
        var x2 = (-b - Math.sqrt(disc)) / (2 * a);

        if (p[1] < r[1])
            return Math.max(x1, x2);
        else
            return Math.min(x1, x2);
    }

    /**
     * Finds the parabola on the beachline at the given x-coordinate
     * @param xx
     * @param root
     * @param sweeplineY
     * @returns {*}
     */
    function getParabolaByX (xx, root, sweeplineY) {
        var par = root;
        var x = 0;

        while (!par.isLeaf) {
            x = getXOfEdge(par, sweeplineY);
            if (x > xx)
                par = par.left;
            else
                par = par.right;
        }
        return par;
    }

    /**
     * Find the y-coordinate of the intersection of the bisector of p and [x, sweeplineY] and of the vertical line at x
     * @param p The point on the beachline closest to x.
     * @param x The x-coordinate of the new point.
     * @param sweeplineY The sweepline's y-coordinate.
     * @returns The y-coordinate of the start of a new Voronoi edge.
     */
    function getY(p, x, sweeplineY) {
        var dp = 2 * (p[1] - sweeplineY);
        var b1 = -2 * p[0] / dp;
        var c1 = sweeplineY + dp / 4 + p[0] * p[0] / dp;
        return x * x / dp + b1 * x + c1;
    }

    /**
     *
     * @param b Parabola
     * @param sweeplineY The sweepline's y-coordinate
     * @param heap
     */
    function computeCircleEvents(b, sweeplineY, heap) {
        var leftParabola = getLeftParent(b);
        var rightParabola = getRightParent(b);

        var a = getLeftChild(leftParabola);
        var c = getRightChild(rightParabola);

        if (!a || !c || a.site === c.site)
            return;

        var s = getEdgeIntersection(leftParabola.edge, rightParabola.edge);
        if (!s)
            return;

        var sax = s[0] - a.site[0];
        var say = s[1] - a.site[1];
        var d = Math.sqrt(sax * sax + say * say);

        if (s[1] - d >= sweeplineY)
            return;

        var e = new CircleEvent([s[0], s[1] - d], b);
        b.circleEventHeapNode = heap.insert(-s[1] + d, e);
    }

    function getEdgeIntersection(a, b) {
        var i = getLineIntersection(a.start, a.B, b.start, b.B);

        // wrong direction of edge
        var wd = (i[0] - a.start[0]) * a.direction[0] < 0 || (i[1] - a.start[1]) * a.direction[1] < 0 //TODO: Epsilon
            || (i[0] - b.start[0]) * b.direction[0] < 0 || (i[1] - b.start[1]) * b.direction[1] < 0;

        if (wd)
            return null; // TODO: what?
        return i;
    }

    /**
     * Finds the ancestor of n for which the path to n is always using the left branch
     * @param n The reference node
     * @returns The ancestor always to the 'right' of n
     */
    function getLeftParent(n) {
        var par = n.parent;
        var pLast = n;
        while (par.left == pLast) {
            if (!par.parent)
                return null;
            pLast = par;
            par = par.parent;
        }
        return par;
    }

    /**
     * Finds the ancestor of n for which the path to n is always using the right branch
     * @param n The reference node
     * @returns The ancestor always to the 'left' of n
     */
    function getRightParent(n) {
        var par = n.parent;
        var pLast = n;
        while (par.right === pLast) {
            if (!par.parent)
                return null;
            pLast = par;
            par = par.parent;
        }
        return par;
    }

    /**
     * Finds the rightmost leaf in the left subtree.
     * @param n The reference node.
     * @returns the rightmost leaf in the left subtree of n.
     */
    function getLeftChild(n) {
        if (!n)
            return null;
        var par = n.left;
        while (!par.isLeaf)
            par = par.right;
        return par;
    }

    /**
     * Finds the leftmost leaf in the right subtree.
     * @param n The reference node.
     * @returns the leftmost leaf in the right subtree of n.
     */
    function getRightChild(n) {
        if (!n)
            return null;
        var par = n.right;
        while (!par.isLeaf)
            par = par.left;
        return par;
    }

    /**
     * Computes the intersection point of two 2D lines
     * @param a1 a point on line a
     * @param a2 a different point on line a
     * @param b1 a point on line b
     * @param b2 a different point on line b
     * @returns The intersection point [x, y] or null, if the lines are parallel.
     */
    function getLineIntersection(a1, a2, b1, b2) {
        var dax = a1[0] - a2[0],
            dbx = b1[0] - b2[0],
            day = a1[1] - a2[1],
            dby = b1[1] - b2[1];

        var det = dax * dby - day * dbx;
        if (det == 0) // TODO: Add epsilon
            return null; // parallel

        var a = a1[0] * a2[1] - a1[1] * a2[0];
        var b = b1[0] * b2[1] - b1[1] * b2[0];

        return [
            (a * dbx - dax * b) / det,
            (a * dby - day * b) / det
        ];
    }

    function Polygon() {
        this.size = 0;
        this.vertices = [];
        this.first = null;
        this.last = null;
    }

    Polygon.prototype = {
        addRight: function (p) {
            this.vertices.push(p);
            ++this.size;
            this.last = p;
            if (this.size == 1)
                this.first = p;
        },

        addLeft: function (p) {
            var vs = this.vertices;
            this.vertices = [p];
            for (var i = 0; i < vs.length; i++)
                this.vertices.push(vs[i]);

            ++this.size;
            this.first = p;
            if (this.size == 1)
                this.last = p;
        }
    };

    function Parabola(s) {
        this.circleEventHeapNode = null;
        this.parent = null;
        this._left = null;
        this._right = null;
        this.site = s;
        this.isLeaf = (this.site != null);
    }

    Parabola.prototype = {
        get left() {return this._left;},
        get right() {return this._right;},
        set left(p) {
            this._left = p;
            p.parent = this;
        },
        set right(p) {
            this._right = p;
            p.parent = this;
        }
    };


    function CircleEvent(p, arch) {
        this.point = p;
        this.arch = arch;
    }

    // start, left, right
    function Edge(s, a, b) {
        this.left = a;		// point on left
        this.right = b;		// point on right

        this.start = s;		// start point
        this.end = null;	// end point

        this.f = (b[0] - a[0]) / (a[1] - b[1]);
        this.g = s[1] - this.f * s[0];
        this.direction = [b[1] - a[1], -(b[0] - a[0])];
        this.B = [s[0] + this.direction[0], s[1] + this.direction[1]];	// second point of the line

        this.neighbour = null;
    }

    // export as AMD/CommonJS module or global variable
    if (typeof define === 'function' && define.amd) define('Voronoi', function () {return Voronoi;});
    else if (typeof module !== 'undefined') module.exports = Voronoi;
    else if (typeof self !== 'undefined') self.Voronoi = Voronoi;
    else window.Voronoi = Voronoi;

})();