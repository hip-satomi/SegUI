import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';

import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { debounceTime } from 'rxjs/operators';
import { ChangeType } from 'src/app/models/change';
import { GlobalTrackingOMEROStorageConnector } from 'src/app/models/storage-connectors';
import { GlobalTrackingModel } from 'src/app/models/tracking/model';
import { TrackingService } from 'src/app/services/tracking.service';

cytoscape.use( dagre );



let node_id = 0;

const line = (length: number, tail=[[],[]]) => {
  const nodes = [];
  const edges = [];
  for (let i = 0; i < length; i++) {
    nodes.push({data: {id: node_id, shortId: node_id}})
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
  const node = {data: {id: node_id, shortId: node_id}};
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
  trModel;

  @Output() selectedNode = new EventEmitter<string>();

  constructor(private trackingService: TrackingService) { }

  ngOnInit() {
    this.trackingService.$currentTrackingModel.subscribe(
      (trCon) => {
        this.registerTrackingCon(trCon);
      }
    )
  }

  registerTrackingCon(trCon: GlobalTrackingOMEROStorageConnector) {
    this.trModel = trCon.getModel();
    trCon.getModel().modelChanged.pipe(
      debounceTime(50000)
    ).subscribe((modelChanged) => {
      if (modelChanged.changeType == ChangeType.HARD) {
        // update visualization
        this.updateFromModel(trCon.getModel());
      }
    });

    this.updateFromModel(trCon.getModel());
  }

  updateLineage() {
    this.updateFromModel(this.trModel);
  }

  updateFromModel(trackingModel: GlobalTrackingModel) {
    if (!this.cy) {
      this.initCy();
    }

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

    // Render node types w.r.t track ends!
    this.cy.$('node').data('type', 'ellipse');

    for (const node of trackingModel.trackingData.forcedTrackEnds) {
      this.cy.$(`node[id = "${node}"]`).data('type', 'rectangle');
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

  initCy() {
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
          'label': 'data(shortId)',
          'shape': 'data(type)',
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
      },
      {
        selector: 'node[type = "rectangle"]',
        css: {
          'background-color': '#ff0000',
        }
      }  
    ],
  
    layout: {
      name: 'dagre',
      rankDir: 'LR'
    }
    });

    this.cy = cy;

    cy.on("tapselect", (event) => this.cySelect(event));
    cy.on("unselect", (event) => this.cyUnselect(event));
  }

  ngAfterViewInit() {
  }

  /** Deletes currently selected nodes or edges */
  delete() {
    console.log("Deletion not yet implemented!")
  }

  cySelect(event) {
    console.log(event);

    if (event.target.length == 1) {
      console.log("Single selection");
      const target = event.target[0]._private;

      if (!("source" in target["data"])) {
        console.log("It is a node!");

        // jump to the frame of the node
        this.selectedNode.emit(target["data"]["id"]);

        this.trackingService.selectedNodes.push(target["data"]["id"]);
      } else {
        // should be an edge
        this.trackingService.selectedEdges.push({source: target["data"]["source"], target: target["data"]["target"]});
      }
    }
  }

  cyUnselect(event) {
    console.log(event);

    if (event.target.length == 1) {
      console.log("Single selection");
      const target = event.target[0]._private;

      if (!("source" in target["data"])) {
        console.log("It is a node!");

        const index = this.trackingService.selectedNodes.indexOf(target["data"]["id"]);
        if (index != -1) {
          this.trackingService.selectedNodes.splice(index, 1);
        }
      } else {
        // should be an edge
        //this.trackingService.selectedEdges.push({source: target["data"]["source"], target: target["data"]["target"]});
        const candidates = this.trackingService.selectedEdges.filter(el => el["source"] == target["data"]["source"] && el["target"] == target["data"]["target"]);

        if (candidates.length == 1) {
          const elIndex = this.trackingService.selectedEdges.indexOf(candidates[0]);
          this.trackingService.selectedEdges.splice(elIndex, 1);
        }
      }
    }
  }

  selectNode(nodeId: string, allowMultiselect = false) {
    if (!allowMultiselect) {
      // deselct all others
      this.cy.filter('node').unselect();
    }
    this.cy.filter(`node[id = "${nodeId}"]`).select();
  }

  centerSelection() {
    this.cy.fit(this.cy.filter(':selected'), 25);
  }

}
