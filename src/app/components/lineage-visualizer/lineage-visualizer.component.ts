import { Component, OnInit, ViewChild } from '@angular/core';

import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

cytoscape.use( dagre );



let node_id = 0;

const line = (length: number, tail=[[],[]]) => {
  const nodes = [];
  const edges = [];
  for (let i = 0; i < length; i++) {
    nodes.push({data: {id: node_id}})
    node_id += 1;

    if (nodes.length >= 2) {
      const edge_nodes = nodes.slice(-2);
      const source = edge_nodes[0];
      const target = edge_nodes[1];
      const edge = { // edge ab
        data: { id: `${source['data']['id']}->${target['data']['id']}`, source: source['data']['id'], target: target['data']['id'] }
      }
      edges.push(edge)
    }
  }

  if (tail[0].length > 0) {
    // connect to first node from tailA
    edges.push(makeEdge(nodes.slice(-1)[0]['data']['id'], tail[0][0]['data']['id']));
  }

  return [[...nodes, ...tail[0]], [...edges, ...tail[1]]];
}

const makeEdge = (sourceId, targetId) => {
  return {
    data: {id: `${sourceId}->${targetId}`, source: sourceId, target: targetId}
  }
}

const split = (tailA, tailB) => {
  const node = {data: {id: node_id}};
  node_id += 1;
  const edges = [];

  if (tailA[0].length > 0) {
    // connect to first node from tailA
    edges.push(makeEdge(node['data']['id'], tailA[0][0]['data']['id']));
  }
  if (tailB[0].length > 0) {
    // connect to first node from tailB
    edges.push(makeEdge(node['data']['id'], tailB[0][0]['data']['id']));
  }

  return [[node, ...tailA[0], ...tailB[0]], [...edges, ...tailA[1], ...tailB[1]]];
}



@Component({
  selector: 'app-lineage-visualizer',
  templateUrl: './lineage-visualizer.component.html',
  styleUrls: ['./lineage-visualizer.component.scss'],
})
export class LineageVisualizerComponent implements OnInit {

  @ViewChild("cytoscape") container;
  cy;

  constructor(private trackingService: TrackingService) { }

  ngOnInit() {
    this.trackingService.$currentTrackingModel.subscribe(
      (trCon) => {
        this.registerTrackingCon(trCon);
      }
    )
  }

  registerTrackingCon(trCon: GlobalTrackingOMEROStorageConnector) {
    trCon.getModel().modelChanged.subscribe((modelChanged) => {
      if (modelChanged.changeType == ChangeType.HARD) {
        // update visualization
        this.updateFromModel(trCon.getModel());
      }
    });

    this.updateFromModel(trCon.getModel());
  }

  updateFromModel(trackingModel: GlobalTrackingModel) {
    const nodes = new Set<string>();
    const edges = new Set();
    for (const link of trackingModel.trackingData.links) {
      nodes.add(link.sourceId);
      nodes.add(link.targetId);
      edges.add({source: link.sourceId, target: link.targetId});
    }

    const nodesInCy = new Set<string>(this.cy.filter("node").map(el => el._private["data"]["id"]));
    
    for(const node of nodes) {
      if (nodesInCy.has(node)) {
        // all good node already present
      } else {
        this.cy.add({data: {id: node, shortId: node.substring(0,4)}})
      }
    }

    for (const node of nodesInCy) {
      if (nodes.has(node)) {
        // all good node is still present
      } else {
        const nodeToDelete = this.cy.filter("node").filter(`node[id = "${node}"]`)
        this.cy.remove(nodeToDelete);
      }
    }

    const edgesInCy = new Set(this.cy.filter("edge").map(el => el._private["data"]["id"]));

    for (const edge of edges) {
      const source = edge["source"];
      const target = edge["target"];
      if (edgesInCy.has(`${source}->${target}`)) {
        // edge already there -> all good!
      } else {
        // need to insert the edge
        this.cy.add({
          data: {
            id: `${source}->${target}`,
            source: source,
            target: target
          }
        });
      }
    }

    const edgeIdSet = new Set([...edges].map(el => `${el["source"]}->${el["target"]}`));

    for (const cyEdge of new Set(this.cy.filter("edge").map(el => el._private["data"]))) {
      const source = cyEdge["source"];
      const target = cyEdge["target"];

      if (edgeIdSet.has(`${source}->${target}`)) {
        // all good, edge is present
      } else {
        // we have to remove the edge
        this.cy.remove(this.cy.filter(`edge[source = "${source}"][target = "${target}"]`));
      }
    }

    const layout = this.cy.makeLayout({name: 'dagre', rankDir: 'LR'});
    layout.run();
  }

  ngAfterViewInit() {
    const [nodes, edges] = line(4, split(line(3, split(line(2), line(5))), line(5, split(line(7), line(4)))));

    const cy = cytoscape({
      container: this.container.nativeElement,
      autoungrabify: true,
      elements: [
      ...nodes,
      ...edges
    ],
  
    style: [ // the stylesheet for the graph
      {
        selector: 'node',
        style: {
          'background-color': '#666',
          'label': 'data(shortId)'
        }
      },
  
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      },
      // give selected things a special color
      {
        selector: ':selected',
        css: {
          'background-color': 'SteelBlue',
          'line-color': 'black',
          'target-arrow-color': 'black',
          'source-arrow-color': 'black'
        }
      }  
    ],
  
    layout: {
      name: 'dagre',
      rankDir: 'LR'
    }
    });

    this.cy = cy;
  }

}
