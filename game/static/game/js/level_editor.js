'use strict';

var ocargo = ocargo || {};

var BACKGROUND_COLOR = '#a8d44a';
var SELECTED_COLOR = '#70961f';
var SUGGESTED_COLOR = '#95b650';
var BORDER = '#bce369';

var BUSH_URL = '/static/game/image/bush.svg';
var TREE1_URL = '/static/game/image/tree1.svg';
var TREE2_URL = '/static/game/image/tree2.svg';
var HOUSE_URL = '/static/game/image/house1_noGreen.svg';
var CFC_URL = '/static/game/image/OcadoCFC_no_road.svg';


ocargo.LevelEditor = function() {
    this.nodes = [];

    // History is stored as a list of ranges of each road segment created, i.e. [[0,4], [4,8]],
    // where 0, 4, 8 are indices of nodes pushed to nodes.
    this.history = [];
    this.start = null;
    this.end = null;
    this.currentStrike = [];
    this.map = this.initialiseVisited();
    this.decor = [];
    this.grid = this.initialiseVisited();

    // Is the start, end or delete mode on?
    this.startFlag = false;
    this.endFlag = false;
    this.deleteFlag = false;

    // type: Node
    this.pathStart = null;
    this.destination = null;
}

ocargo.LevelEditor.prototype.initialiseVisited = function() {
    var visited = new Array(10);
    for (var i = 0; i < 10; i++) {
        visited[i] = new Array(8);
    }
    return visited;
}

ocargo.LevelEditor.prototype.createGrid = function(paper) {
    for (var i = 0; i < GRID_WIDTH; i++) {
        for (var j = 0; j < GRID_HEIGHT; j++) {
            var x = i * GRID_SPACE_SIZE;
            var y = j * GRID_SPACE_SIZE;
            var segment = paper.rect(x, y, GRID_SPACE_SIZE, GRID_SPACE_SIZE);
            segment.attr({stroke: BORDER, fill: BACKGROUND_COLOR, "fill-opacity": 0});

            segment.node.onmousedown = function() {
                var this_rect = segment;

                return function() {
                    var getBBox = this_rect.getBBox();
                    var coord = new ocargo.Coordinate(getBBox.x / 100, getBBox.y / 100);
                    var transCoord = ocargo.levelEditor.translate(coord);
                    var isPresent = ocargo.levelEditor.findNodeByCoordinate(ocargo.levelEditor.nodes, transCoord);
                    
                    if (ocargo.levelEditor.startFlag && isPresent > -1) {
                        if(ocargo.levelEditor.pathStart) {
                            var prevStart = ocargo.levelEditor.translate(
                                ocargo.levelEditor.pathStart.coordinate);
                            ocargo.levelEditor.mark(prevStart, BACKGROUND_COLOR, 0, true);
                        }

                        ocargo.levelEditor.mark(coord, 'red', 1, true);
                        var prevIndex = ocargo.levelEditor.findNodeByCoordinate(
                            ocargo.levelEditor.nodes, transCoord);
                        // Putting the new start in the front of the nodes list.
                        var temp = ocargo.levelEditor.nodes[prevIndex];
                        ocargo.levelEditor.nodes[prevIndex] = ocargo.levelEditor.nodes[0];
                        ocargo.levelEditor.nodes[0] = temp;
                        ocargo.levelEditor.pathStart = ocargo.levelEditor.nodes[0];

                    } else if (ocargo.levelEditor.endFlag && isPresent > -1) {
                         if(ocargo.levelEditor.destination) {
                            var prevEnd = ocargo.levelEditor.translate(
                                ocargo.levelEditor.destination.coordinate);
                            ocargo.levelEditor.mark(prevEnd, BACKGROUND_COLOR, 0, true);
                        }
                        ocargo.levelEditor.mark(coord, 'blue', '1', true);
                        var newEnd = ocargo.levelEditor.findNodeByCoordinate(ocargo.levelEditor.nodes, transCoord);
                        ocargo.levelEditor.destination = ocargo.levelEditor.nodes[newEnd];

                    } else if (ocargo.levelEditor.deleteFlag ||
                        !(ocargo.levelEditor.endFlag || ocargo.levelEditor.startFlag)) {
                        ocargo.levelEditor.start = coord;
                        ocargo.levelEditor.mark(coord, SELECTED_COLOR, 1, true);
                    }
                }
            } ();


            segment.node.onmouseover = function() {
                var this_rect = segment;

                return function() {
                    var startOrEnd = ocargo.levelEditor.endFlag || ocargo.levelEditor.startFlag
                    if (ocargo.levelEditor.start !== null && !startOrEnd) {
                        var getBBox = this_rect.getBBox();
                        var coord = new ocargo.Coordinate(getBBox.x / 100, getBBox.y / 100);
                        ocargo.levelEditor.recalculatePredictedRoad(coord);
                    }
                }
                return;
            } ();

            segment.node.onmouseup = function() {
                var this_rect = segment;

                return function() {
                    var startOrEnd = ocargo.levelEditor.endFlag || ocargo.levelEditor.startFlag
                    if (!startOrEnd) {
                        ocargo.levelEditor.end = segment;
                        var getBBox = this_rect.getBBox();
                        var coord = new ocargo.Coordinate(getBBox.x / 100, getBBox.y / 100);
                        if (ocargo.levelEditor.deleteFlag) {
                            ocargo.levelEditor.finaliseDelete(coord);
                        } else {
                            ocargo.levelEditor.finaliseMove(coord);
                        }
                        paper.clear();
                        ocargo.levelEditor.start = null;
                        ocargo.levelEditor.createGrid(paper)
                        createRoad(ocargo.levelEditor.nodes);
                        drawDecor(ocargo.levelEditor.decor);
                        if (ocargo.levelEditor.pathStart !== null) {
                            coord = ocargo.levelEditor.translate(ocargo.levelEditor.pathStart.coordinate);
                            ocargo.levelEditor.mark(coord, 'red', 1, true);
                        } 
                        if (ocargo.levelEditor.destination !== null) {
                            coord = ocargo.levelEditor.translate(ocargo.levelEditor.destination.coordinate);
                            ocargo.levelEditor.mark(coord, 'blue', 1, true);
                        }
                    }
                }
            } ();

            this.grid[i][j] = segment;
            this.map[i][j] = false;
        }
    }
};

ocargo.LevelEditor.prototype.finaliseDelete = function(coord) {
    var x, y;
    if (this.start.x <= coord.x) {
        for (x = this.start.x + 1; x <= coord.x; x++) {
            deleteNode(x, this.start.y);
        }
    } else {
        for (x = this.start.x - 1; x >= coord.x; x--) {
            deleteNode(x, this.start.y);
        }
    }
    if (this.start.y <= coord.y) {
        for (y = this.start.y + 1; y <= coord.y; y++) {
            deleteNode(coord.x, y);
        }
    } else {
        for (y = this.start.y - 1; y >= coord.y; y--) {
            deleteNode(coord.x, y);
        }
    }

    function deleteNode(x, y) {
        var coord = ocargo.levelEditor.translate(new ocargo.Coordinate(x, y));
        var nodeIndex = ocargo.levelEditor.findNodeByCoordinate(ocargo.levelEditor.nodes, coord);
        if (nodeIndex > -1) {
            var node = ocargo.levelEditor.nodes[nodeIndex];
            // Remove all the references to the node we're removing.
            for (var i = 0; i < node.connectedNodes.length; i++) {
                node.removeDoublyConnectedNode(node.connectedNodes[i]);
            }
            var index = ocargo.levelEditor.nodes.indexOf(node);
            ocargo.levelEditor.nodes.splice(index, 1);
        }
    }

}

ocargo.LevelEditor.prototype.finaliseMove = function(coord) {
    var current;
    var prev;

    this.history.push([this.start, this.end]);

    for (var i = 0; i < ocargo.levelEditor.currentStrike.length; i++) {
        current = ocargo.levelEditor.currentStrike[i];
        var index = this.findNodeByCoordinate(this.nodes, current.coordinate);
        if (index > -1) {
            var alreadyExisting = ocargo.levelEditor.nodes[index];
            var list = []
            for (var j = 0; j < current.connectedNodes.length; j++) {
                var neighbour = current.connectedNodes[j];
                alreadyExisting.addConnectedNodeWithBacklink(neighbour);
                list.push(neighbour);
            }
            for(var k = 0; k < list.length; k++) {
                list[k].removeDoublyConnectedNode(current);
            }

        } else {
            this.nodes.push(current);
        }
    }
    this.currentStrike = [];
}

ocargo.LevelEditor.prototype.findNodeByCoordinate = function(nodes, coordinate) {
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].coordinate.x === coordinate.x && nodes[i].coordinate.y === coordinate.y) {
            return i;
        }
    }
    return -1;
}

ocargo.LevelEditor.prototype.recalculatePredictedRoad = function(coordinate) {
    ocargo.levelEditor.cleanPredictedRoad(coordinate);
    ocargo.levelEditor.markFromStart(coordinate);
};

ocargo.LevelEditor.prototype.markFromStart = function(coord) {
    ocargo.levelEditor.currentStrike.push(new ocargo.Node(this.translate(this.start)));
    ocargo.levelEditor.mark(this.start, SELECTED_COLOR, 1, true);
    var x, y;

    if (this.start.x <= coord.x) {
        for (x = this.start.x + 1; x <= coord.x; x++) {
            setup(x, this.start.y);
        }
    } else {
        for (x = this.start.x - 1; x >= coord.x; x--) {
            setup(x, this.start.y);
        }
    }
    if (this.start.y <= coord.y) {
        for (y = this.start.y + 1; y <= coord.y; y++) {
            setup(coord.x, y);
        }
    } else {
        for (y = this.start.y - 1; y >= coord.y; y--) {
            setup(coord.x, y);
        }
    }

    function setup(x, y) {
        var coordinate = new ocargo.Coordinate(x, y);
        var node = new ocargo.Node(ocargo.levelEditor.translate(coordinate));
        node.addConnectedNodeWithBacklink(
            ocargo.levelEditor.currentStrike[ocargo.levelEditor.currentStrike.length - 1]);
        ocargo.levelEditor.currentStrike.push(node);
        ocargo.levelEditor.mark(coordinate, SELECTED_COLOR, 1, true);
    }
};

ocargo.LevelEditor.prototype.cleanPredictedRoad = function() {
    var node;
    var coord;
    for (var i = this.currentStrike.length - 1; i >=0; i--) {
        node = ocargo.levelEditor.currentStrike[i];
        coord = ocargo.levelEditor.translate(node.coordinate);
        ocargo.levelEditor.mark(coord, BACKGROUND_COLOR, 0, false);
        // TODO: Handle removing remaining references - although we pop, we think 
        //    we are pointing to another node. §
    }
    ocargo.levelEditor.currentStrike = [];
};

ocargo.LevelEditor.prototype.translate = function(coordinate) {
    return new ocargo.Coordinate(coordinate.x, GRID_HEIGHT - 1 - coordinate.y);
}

ocargo.LevelEditor.prototype.mark = function(point, colour, opacity, occupied) {
    var element = this.grid[point.x][point.y];
    this.map[point.x][point.y] = occupied;
    element.attr({fill:colour, "fill-opacity": opacity});
};

Raphael.st.draggableDecor = function() {
    var me = this,
        lx = 0,
        ly = 0,
        ox = 0,
        oy = 0,
        url = '',
        moveFnc = function(dx, dy) {
            lx = dx + ox;
            ly = dy + oy;
            me.transform('t' + lx + ',' + ly);
        },
        startFnc = function() {
            var x = ox / GRID_SPACE_SIZE;
            var y = oy / GRID_SPACE_SIZE;
            // Find the element in decor and remove it.
            for (var i = 0; i < ocargo.levelEditor.decor.length; i++) {
                if (ocargo.levelEditor.decor[i].coordinate.x === x &&
                    ocargo.levelEditor.decor[i].coordinate.y === GRID_HEIGHT - 1 - y) {
                    url = ocargo.levelEditor.decor[i].url;
                    ocargo.levelEditor.decor.splice(i, 1);
                    break;
                }
            }
            //ocargo.levelEditor.map[x][y] = false;
        },
        endFnc = function() {
            var point = getGridSpace(lx, ly);
            ox = point[0] * GRID_SPACE_SIZE;
            oy = point[1] * GRID_SPACE_SIZE;
            me.transform('t' + ox + ',' + oy);
            var coord = new ocargo.Coordinate(point[0], GRID_HEIGHT - 1 - point[1]);
            ocargo.levelEditor.decor.push({'coordinate': coord, 'url': url});

            //ocargo.levelEditor.map[point[0]][point[1]] = true;
        };

    this.drag(moveFnc, startFnc, endFnc);

}

function initialiseDecorGraphic(url) {
    var myset = paper.set();
    myset.push(paper.image(url, 0, 0, 100, 100));
    myset.draggableDecor();
    var coord = new ocargo.Coordinate(0, 7);
    ocargo.levelEditor.decor.push({'coordinate': coord, 'url': url});
}

function sortNodes(nodes) {
    for (var i = 0; i < nodes.length; i++) {
        // Remove duplicates.
        var newConnected = []
        for (var j = 0; j < nodes[i].connectedNodes.length; j++) {
            if (newConnected.indexOf(nodes[i].connectedNodes[j]) === -1) {
                newConnected.push(nodes[i].connectedNodes[j]);
            }
        }
        nodes[i].connectedNodes.sort(function(a, b) { return comparator(a, b, nodes[i])}).reverse();
    }
}

function comparator(node1, node2, centralNode) {
    var coord1 = node1.coordinate;
    var coord2 = node2.coordinate;
    var center = centralNode.coordinate;

    var a1 = ocargo.calculateNodeAngle(centralNode, node1);
    var a2 = ocargo.calculateNodeAngle(centralNode, node2)
    if (a1 < a2) {
        return -1;
    } else if (a1 > a2) {
        return 1;
    } else {
        return 0;
    }
}

$('#bush').click(function() {
    initialiseDecorGraphic(BUSH_URL);
});

$('#tree1').click(function() {
    initialiseDecorGraphic(TREE1_URL);
});

$('#tree2').click(function() {
    initialiseDecorGraphic(TREE2_URL);
});

$('#clear').click(function() {
    paper.clear();
    ocargo.levelEditor = new ocargo.LevelEditor();
    ocargo.levelEditor.createGrid(paper);
});

$('#start').click(function() {
    ocargo.levelEditor.startFlag = !ocargo.levelEditor.startFlag;
    ocargo.levelEditor.endFlag = false;
});

$('#end').click(function() {
    ocargo.levelEditor.endFlag = !ocargo.levelEditor.endFlag;
    ocargo.levelEditor.startFlag = false;
});

$('#undo').click(function() {
    ocargo.levelEditor.deleteFlag = !ocargo.levelEditor.deleteFlag;
    var text = ocargo.levelEditor.deleteFlag ? "Delete Mode On" : "Delete Mode Off";
    $(this).text(text);
});

ocargo.LevelEditor.prototype.oldPathToNew = function() {
    var newPath = [];
    
    for(var i = 0; i < this.nodes.length; i++) {
        var curr = this.nodes[i];
        var node = {'coordinate': [curr.coordinate.x, curr.coordinate.y], 'connectedNodes': []};
        
        for(var j = 0; j < curr.connectedNodes.length; j++) {
            var index = this.findNodeByCoordinate(this.nodes, curr.connectedNodes[j].coordinate);
            node.connectedNodes.push(index);
        }
        newPath.push(node);
    }
    return newPath;
}

$("#export").click(function() {

    sortNodes(ocargo.levelEditor.nodes);
    var input_string = JSON.stringify(ocargo.levelEditor.oldPathToNew(ocargo.levelEditor.nodes));
    console.debug(input_string);
    var blockTypes = [];
    var endCoord = ocargo.levelEditor.destination.coordinate;
    var destination = JSON.stringify([endCoord.x, endCoord.y]);
    var decor = JSON.stringify(ocargo.levelEditor.decor);
    var maxFuel = $('#maxFuel').val();

    $('.js-block-checkbox:checked').each(function(index, checkbox) {
        blockTypes.push(checkbox.id);
    });

    $.ajax({
        url: "/game/levels/new",
        type: "POST",
        dataType: 'json',
        data: {
            nodes: input_string,
            destination: destination,
            decor: decor,
            maxFuel: maxFuel,
            blockTypes: JSON.stringify(blockTypes),
            csrfmiddlewaretoken: $("#csrfmiddlewaretoken").val()
        },
        success: function (json) {
            window.location.href = ("/game/" + json.server_response);

        },
        error: function (xhr, errmsg, err) {
            console.debug(xhr.status + ": " + errmsg + " " + err + " " + xhr.responseText);
        }
    });

    return false;
    });

$(function() {
    paper.clear();
    ocargo.ui = new ocargo.SimpleUi();
    ocargo.levelEditor = new ocargo.LevelEditor();
    ocargo.levelEditor.createGrid(paper);
    $('#undo').text("Delete Mode");

});

