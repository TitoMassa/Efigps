## 2024-05-23 - Micro-optimization in Geodata Processing
**Learning:** Using `Math.hypot` or Equirectangular approximation for distance comparisons in hot loops is significantly faster than Haversine, even for JavaScript which is generally fast. V8 optimizes simple math well, but trigonometric functions in Haversine add up when called millions of times.
**Action:** Always check if exact geodesic distance is needed or if an approximation/Euclidean distance suffices for comparisons in `for` loops.
