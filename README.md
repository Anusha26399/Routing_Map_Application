# 🗺️ Routing Map Application

A routing web application that provides:
- **Shortest Path Calculation**
- **Carbon Emission Color-Coded Routes**
- **Multi-Destination Route Planning**

---

## 🚀 Features

- 🔍 Find nearest road vertex to your location
- 🧭 Shortest route calculation using Dijkstra's algorithm
- ♻️ Color-coded carbon emission info on routes
- 🗓️ Planned multi-destination routing with optimized travel path (TSP)

---

## 🧰 Tech Stack

### Backend
- **PostgreSQL + PostGIS**: Spatial database
- **PgRouting**: Pathfinding with `pgr_dijkstra`, `pgr_dijkstraCostMatrix`, `pgr_TSP`
- **GeoServer**: Serving spatial data as WMS/WFS
- **QGIS**: Map styling and layer creation

### Frontend
- **HTML**, **CSS**, **JavaScript**

---

## 🧮 SQL Views

### 🔹 1. Find Nearest Vertex

```sql
SELECT v.id, v.the_geom 
FROM road_vmc_vertices_pgr AS v 
JOIN road_vmc AS e 
  ON e.source = v.id OR e.target = v.id 
WHERE v.id = (
  SELECT id 
  FROM road_vmc_vertices_pgr 
  ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(%x%, %y%), 4326) 
  LIMIT 1
) 
GROUP BY v.id, v.the_geom;
``` 
🔹 2. Shortest Path Between Two Points
``` 
SELECT 
  MIN(r.seq) AS seq,
  e.id AS id,
  SUM(ST_Length(e.geom)) AS distance,
  ST_Collect(e.geom) AS geom
FROM pgr_dijkstra(
  'SELECT id, source, target, cost, reverse_cost FROM ahm_roads',
  %source%, %target%, false
) AS r
JOIN ahm_roads AS e ON r.edge = e.id
GROUP BY r.seq, e.id;
``` 
🔹 3. Planned Multi-Destination Route (TSP)
``` 
WITH tsp_route AS (
  SELECT * FROM pgr_TSP($$
    SELECT * FROM pgr_dijkstraCostMatrix(
      'SELECT id, source, target, cost, reverse_cost FROM ahm_roads',
      ARRAY[%source%, %target1%, %target2%, %target3%, %target4%]
    )
  $$, start_id := %source%)
),
filtered_tsp AS (
  SELECT * FROM tsp_route WHERE seq < (
    SELECT MAX(seq) FROM tsp_route
  )
),
ordered_nodes AS (
  SELECT seq, node, LEAD(node) OVER (ORDER BY seq) AS next_node 
  FROM filtered_tsp
),
full_path AS (
  SELECT 
    path.seq, path.node, path.edge, path.cost, path.agg_cost,
    e.id, e.geom 
  FROM ordered_nodes onodes
  JOIN LATERAL pgr_dijkstra(
    'SELECT id, source, target, cost, reverse_cost FROM ahm_roads',
    onodes.node, onodes.next_node, directed := false
  ) AS path ON path.node IS NOT NULL
  JOIN ahm_roads e ON path.edge = e.id
)

SELECT id, geom FROM full_path;
```  

📦 Deployment Tips
Set up your database with PostgreSQL, PostGIS, and PgRouting.

Use QGIS to prepare and export your road layers.

Host spatial layers on GeoServer and consume them via WMS in frontend.

Integrate all map layers and logic using JavaScript (OpenLayers).


