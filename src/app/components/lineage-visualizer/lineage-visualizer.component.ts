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
export class LineageVisualizerComponent {

  @ViewChild("cytoscape") container;

  constructor() { }

  ngAfterViewInit() {
    const [nodes, edges] = line(4, split(line(3, split(line(2), line(5))), line(5, split(line(7), line(4)))));

    var cy = cytoscape({
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
          'label': 'data(id)'
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

  }

}
