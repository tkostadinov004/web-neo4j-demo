CREATE CONSTRAINT intersection_id IF NOT EXISTS FOR (i:Intersection) REQUIRE i.id IS UNIQUE;

LOAD CSV WITH HEADERS FROM 'file:///nodes.csv' AS row
CREATE (:Intersection {id: row.id, geom: row.geom});

LOAD CSV WITH HEADERS FROM 'file:///pedestrian_network_noded.csv' AS row
MATCH (source:Intersection {id: row.source})
MATCH (target:Intersection {id: row.target})
CREATE (source)-[r:ROAD {
  cost: toFloat(row.cost)
}]->(target);

CALL gds.graph.project(
  'streetNetwork',
  'Intersection',
  {
    ROAD: {
      orientation: 'UNDIRECTED'
    }
  },
  {
    relationshipProperties: 'cost'
  }
);

MATCH (start:Intersection {id: '3612'}) // example start
MATCH (end:Intersection {id: '48009'}) // example end

CALL gds.shortestPath.dijkstra.stream('streetNetwork', {
  sourceNode: start,
  targetNode: end,
  relationshipWeightProperty: 'cost'
})
YIELD path, totalCost

RETURN totalCost, [node IN nodes(path) | node.geom] as geom_sequence;