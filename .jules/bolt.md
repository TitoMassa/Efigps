## 2024-05-23 - [Approximating Geodetic Distance for Performance]
**Learning:** In hot loops checking deviation against thousands of route segments, using Haversine distance for every comparison is a major bottleneck. An equirectangular approximation (squared Euclidean on lat/lon with longitude scaling) is sufficient for finding the *closest* point and is significantly faster (~2-3x).
**Action:** Use `getSquaredDistance` with equirectangular approximation for search/sorting of geospatial points, and only compute exact Haversine distance when the final precise value is needed.
