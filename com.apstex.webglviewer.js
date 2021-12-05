Annotation = function()
{
	this.cameraView = undefined;
	this.cadObjects = [];
	this.text = undefined;
	this.link = undefined;
};

Annotation.prototype = 
{

};
var cameraViewIDCounter = -4;

/**
 * Creates an instance of CameraView.
 * @param {String} name - the name of this view. Optional, can be undefined.
 * @param {THREE.Vector3} cameraViewPoint - the position of the camera. If undefined then model will be fit into screen.
 * @param {THREE.Vector3} cameraDirection - the direction of the camera. If undefined then cameraViewPoint, cameraDirection and cameraUpVector will be taken from current view.
 * @param {THREE.Vector3} cameraUpVector - the up vector of the camera. If undefined then cameraViewPoint, cameraDirection and cameraUpVector will be taken from current view.
 */
CameraView = function(name, cameraViewPoint, cameraDirection, cameraUpVector)
{
	this.id = cameraViewIDCounter++;
	this.name = name;
	if(cameraDirection === undefined || cameraUpVector === undefined)
	{
		this.fromCurrentView();
		if(cameraViewPoint)
		{
			this.cameraViewPoint = cameraViewPoint;
		}
	}
	else
	{
		this.cameraViewPoint = cameraViewPoint;
		this.cameraDirection = cameraDirection;
		this.cameraUpVector =  cameraUpVector;
	}
};

CameraView.prototype = 
{
	applyView: function(isAnimated)
	{
		var camera = WebGLViewer.camera;
		if(isAnimated)
		{
			if(this.cameraViewPoint === undefined)
			{
				//get current camera vectors
				var currentPos = camera.position.clone();
				var currentUp = camera.up.clone();
				var currentDir = new THREE.Vector3(0, 0, -1);
				currentDir.applyEuler(camera.rotation, camera.rotation.order);
				currentUp.normalize();
				currentDir.normalize();
				//change camera vectors for computation temporary
				var lookAt = new THREE.Vector3();
				lookAt.addVectors(camera.position, this.cameraDirection);
				camera.up = this.cameraUpVector;
				camera.lookAt(lookAt);
				//compute new position for fit in
				var bbox = WebGLViewer.cameraHelper.getSceneBoundingBox();
				var fitInVectors = WebGLViewer.cameraHelper.computeFitInVectors(bbox);
				var newPos = fitInVectors[0];
				//reset current camera vectors
				lookAt = new THREE.Vector3();
				lookAt.addVectors(camera.position, currentDir);
				camera.up = currentUp;
				camera.lookAt(lookAt);
				//start animation
				WebGLViewer.cameraAnimation.flyTo(newPos, this.cameraUpVector, this.cameraDirection);
			}
			else
			{
				WebGLViewer.cameraAnimation.flyTo(this.cameraViewPoint, this.cameraUpVector, this.cameraDirection);
			}
		}
		else
		{
			var position = this.cameraViewPoint === undefined ? camera.position : this.cameraViewPoint;
			camera.position.set(position.x, position.y, position.z);
			var lookAt = new THREE.Vector3();
			lookAt.addVectors(position, this.cameraDirection);
			camera.up = this.cameraUpVector;
			camera.lookAt(lookAt);
			if(this.cameraViewPoint === undefined)
			{
				WebGLViewer.cameraHelper.fitInScene();
			}
			WebGLViewer.render();
		}
	},
	
	fromCurrentView: function()
	{
		var camera = WebGLViewer.camera;
		this.cameraDirection = new THREE.Vector3(0, 0, -1);
		this.cameraDirection.applyEuler(camera.rotation, camera.rotation.order);
		this.cameraUpVector = camera.up.clone().normalize();
		this.cameraViewPoint = camera.position.clone();
	}
};
CameraViewPanel = function()
{
	this.id = "cameraviewpanel";
	this.init();
};

CameraViewPanel.prototype =
{
	init: function()
	{
		CommentModel.addListener(this);
		WebGLViewer.menuBar.addView(this);
		this.update();
	},
	
	cameraViewsAdded: function(cameraViews)
	{
		this.update();
	},
	
	annotationsAdded: function(annotations)
	{
		
	},
	
	commentsAdded: function(comments)
	{
		
	},
	
	update: function(jsonSpatialModel)
	{
		var div_view = WebGLViewer.menuBar.getElementById(this.id);
		if( ! div_view)
			return;
		var cameraViews = CommentModel.cameraViews;
		var text = "<br>";
		for(var i = 0; i < cameraViews.length; i++)
		{
			var cameraView = cameraViews[i];
			text += "<button class='button view' onClick='CommentModel.applyCameraView("+cameraView.id+");'>"+cameraView.name+"</button> ";
		}
		text += "<button class='button view' onClick='CommentModel.storeCurrentCameraView(\"VIEW "+cameraViewIDCounter+"\");'>SAVE VIEW</button><br><br>"
		div_view.innerHTML = text;
	}
};
Comment = function()
{
	this.guid = undefined;
	this.title = undefined;
	this.cameraView = undefined;
	this.link = undefined;
	this.cadObjects = [];
	this.replies = [];
};

Comment.prototype = 
{

};
CommentModel = function()
{
	this.listeners = [];
	this.cameraViews = [];
	this.annotations = [];
	this.comments = [];
	this.isCameraAnimationEnabled = true;
};

CommentModel.prototype =
{
	createStandardViews: function()
	{
		this.addCameraView(new CameraView("FRONT", undefined, new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1)));
		this.addCameraView(new CameraView("LEFT", undefined, new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,1)));
		this.addCameraView(new CameraView("REAR", undefined, new THREE.Vector3(0,-1,0), new THREE.Vector3(0,0,1)));
		this.addCameraView(new CameraView("RIGHT", undefined, new THREE.Vector3(-1,0,0), new THREE.Vector3(0,0,1)));
		this.addCameraView(new CameraView("TOP", undefined, new THREE.Vector3(0,0,-1), new THREE.Vector3(0,1,0)));
		this.createIsoView("ISO FRONT-LEFT", -45, -30);
		this.createIsoView("ISO REAR-LEFT", -135, -30);
		this.createIsoView("ISO REAR-RIGHT", 135, -30);
		this.createIsoView("ISO FRONT-RIGHT", 45, -30);
	},
	
	/**
	 * Creates an ISO view.
	 * @param name {String} the name of the view.
	 * @param horizontalAngle {Number} the angle of the horizontal rotation in degrees.
	 * @param verticalAngle {Number} the angle of the vertical rotation in degrees.
	 */
	createIsoView: function(name, horizontalAngle, verticalAngle)
	{
		var dir = new THREE.Vector3(0, 1, 0);
		var up = new THREE.Vector3(0, 0, 1);
		var horizontalAngle = horizontalAngle / 180 * Math.PI;
		var verticalAngle = verticalAngle / 180 * Math.PI;
		var m1 = new THREE.Matrix4().makeRotationX(verticalAngle);
		var m2 = new THREE.Matrix4().makeRotationZ(horizontalAngle);
		var matrix = new THREE.Matrix4().multiplyMatrices(m2, m1);
		dir = dir.applyMatrix4(matrix);
		up = up.applyMatrix4(matrix);
		this.addCameraView(new CameraView(name, undefined, dir, up));
	},
		
	/**
	 * Adds a listener to this model.
	 * The listener must implement the following method(s):
	 * - cameraViewsAdded(CameraView[] cameraViews)
	 * - annotationsAdded(Annotation[] annotations)
	 * - commentsAdded(Comment[] comments)
	 * The method(s) will be invoked by this model, when a corresponding event occurs.
	 * @param {Object} listener - the listener to be added.
	 */
	addListener: function(listener)
	{
		this.listeners.push(listener);
	},
	
	addCameraView: function(cameraView)
	{
		this.cameraViews.push(cameraView);
		var cameraViews = [cameraView];
		this.fireCameraViewsAdded(cameraViews);
	},
	
	storeCurrentCameraView: function(name)
	{
		var cameraView = new CameraView(name);
		this.addCameraView(cameraView);
	},
	
	applyCameraView: function(cameraViewId)
	{
		for (var i = 0; i < this.cameraViews.length; i++)
		{
			if(this.cameraViews[i].id === cameraViewId)
			{
				this.cameraViews[i].applyView(this.isCameraAnimationEnabled);
				break;
			}
		}
	},
	
	addAnnotation: function(annotation)
	{
		this.annotations.push(annotation);
		var annotations = [annotation];
		this.fireCameraViewsAdded(annotations);
	},
	
	addComment: function(comment)
	{
		this.comments.push(comment);
		var comments = [comment];
		this.fireCameraViewsAdded(comments);
	},
	
	fireCameraViewsAdded: function(cameraViews)
	{
		for (var i = 0; i < this.listeners.length; i++)
		{
			this.listeners[i].cameraViewsAdded(cameraViews);
		}
	},
	
	fireAnnotationsAdded: function(annotations)
	{
		for (var i = 0; i < this.listeners.length; i++)
		{
			this.listeners[i].annotationsAdded(annotations);
		}
	},
	
	fireCommentsAdded: function(comments)
	{
		for (var i = 0; i < this.listeners.length; i++)
		{
			this.listeners[i].commentsAdded(comments);
		}
	}
};

var CommentModel = new CommentModel();
Reply = function()
{
	this.guid = undefined;
	this.verbalStatus = undefined;
	this.status = undefined;
	this.date = undefined;
	this.author = undefined;
	this.text = undefined;
};

Reply.prototype = 
{

};
/**
 * Creates an instance of ApplicationController.
 * @constructor
 * @property {Boolean} isTransparentViewEnabled - whether transparent view is enabled or not.
 * @property {Boolean} isWireFramedViewEnabled - whether wire framed view is enabled or not.
 * @property {Boolean} isEdgeViewEnabled - whether edge view is enabled or not.
 * @property {Number} CREATE_EDGE_TOLERANCE - tolerance used for first check, whether edges between adjacent triangles should be created (default: 1e-5).
 * @property {Number} CREATE_EDGE_MAX_ANGLE_VARIATION - cosine of maximum angle between two adjacent triangles to decide whether an edge should be created or not (default: Math.cos(30*Math.PI/180) = 30 degrees).
 */
ApplicationController = function()
{
	this.isTransparentViewEnabled = false;
	this.isWireFramedViewEnabled = false;
	this.isEdgeViewEnabled = false;
	this.CREATE_EDGE_TOLERANCE = 1e-5;
	this.CREATE_EDGE_MAX_ANGLE_VARIATION = Math.cos(30 * Math.PI / 180);
	this.DEFAULT_EDGE_COLOR = 0x000000;
	this.DEFAULT_EDGE_RADIUS = undefined; //value in Meter or undefined for lineThickness=1.0
};

ApplicationController.prototype =
{
	/**
	 * Changes the visibility of cad objects of the specified type.
	 * @param {String} type - The type of the cad objects, e.g. "IfcWall".
	 * @param {Boolean} isVisible - true, if objects should be shown. false, if objects should be hidden.
	 */
	setTypeVisible: function(type, isVisible)
	{
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var applicationModelNode = nodes[i];
			var cadObjects = applicationModelNode.getCadObjectsOfType(type);
			WebGLViewer.applicationModelRoot.visibilityModel.setObjectsVisible(cadObjects, isVisible);
		}
	},
	
	/**
	 * Enables the edge view, if edge view is disabled.
	 * Disables the edge view, if edge view is enabled.
	 */
	toggleEdgeView: function()
	{
		this.setEdgesVisible( ! this.isEdgeViewEnabled);
	},
	
	/**
	 * Enables or disables the edge view.
	 * @param {Boolean} isVisible - true, if edge view should be enabled. false, if edge view should be disabled.
	 */
	setEdgesVisible: function(isVisible)
	{
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var applicationModelNode = nodes[i];
			var cadObjects = applicationModelNode.getCadObjects();
			for(var j = 0; j < cadObjects.length; j++)
			{
				var cadObject = cadObjects[j];
				cadObject.createEdges();
				cadObject.setEdgesVisible(isVisible);
			}
		}
		this.isEdgeViewEnabled = isVisible;
		WebGLViewer.render();
		WebGLViewer.menuBar.setButtonActive("edgeview", isVisible);
	},
	
	/**
	 * Changes the edge color of all entities.
	 * @param {Number} color - the color to be set (e.g. 0x000000).
	 */
	setEdgeColor: function(color)
	{
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var applicationModelNode = nodes[i];
			var cadObjects = applicationModelNode.getCadObjects();
			for(var j = 0; j < cadObjects.length; j++)
			{
				var cadObject = cadObjects[j];
				cadObject.setEdgeColor(color);
			}
		}
		WebGLViewer.render();
	},
		
	/**
	 * Changes the selection state of cad objects of the specified type.
	 * @param {String} type - The type of the cad objects, e.g. "IfcWall".
	 * @param {Boolean} isVisible - true, if objects should be selected. false, if objects should be deselected.
	 */
	setTypeSelected: function(type, isSelected)
	{
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var applicationModelNode = nodes[i];
			var cadObjects = applicationModelNode.getCadObjectsOfType(type);
			WebGLViewer.applicationModelRoot.selectionModel.setObjectsSelected(cadObjects, isSelected);
		}
	},
	
	/**
	 * Changes the visibility of selected objects.
	 * @param {Boolean} isVisible - true, if objects should be shown. false, if objects should be hidden.
	 */
	setSelectedCadObjectsVisible: function(isVisible)
	{
		var selectedCadObjects = WebGLViewer.applicationModelRoot.selectionModel.getSelectedObjects();
		WebGLViewer.applicationModelRoot.visibilityModel.setObjectsVisible(selectedCadObjects, isVisible);
	},
	
	/**
	 * Resets the view settings. 
	 * Selection will get cleared.
	 * Hidden objects will be set visible.
	 * Wire framed and transparent view will be disabled.
	 * Initial perspective will be set.
	 */
	resetView: function()
	{
		WebGLViewer.applicationModelRoot.selectionModel.clearSelection();
		var invisibleObjects = WebGLViewer.applicationModelRoot.visibilityModel.getInvisibleObjects();
		WebGLViewer.applicationModelRoot.visibilityModel.setObjectsVisible(invisibleObjects, true);
		this.setWireFramedViewEnabled(false);
		this.setTransparentViewEnabled(false);
		WebGLViewer.camera.up = new THREE.Vector3(0,0,1);
		WebGLViewer.camera.position.set(0,-10,0);
		WebGLViewer.camera.lookAt(new THREE.Vector3(0,0,0));
		WebGLViewer.cameraHelper.fitInScene();
	},
	
	/**
	 * Enables or disables the wire framed view.
	 * @param {Boolean} isEnabled - true, if wire framed view should be enabled. false, if wire framed view should be disabled.
	 */
	setWireFramedViewEnabled: function(isEnabled)
	{
		if(this.isWireFramedViewEnabled === isEnabled)
			return;
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var node = nodes[i];
			for(var j = 0; j < node.mesh.material.length; j++)
			{
				var material = node.mesh.material[j];
				material.wireframe = isEnabled;
			}
		}
		this.isWireFramedViewEnabled = isEnabled;
		WebGLViewer.render();
		WebGLViewer.menuBar.setButtonActive("wireframed", isEnabled);
	},
	
	/**
	 * Enables the wire framed view, if wire framed view is disabled.
	 * Disables the wire framed view, if wire framed view is enabled.
	 */
	toggleWireFramedView: function()
	{
		this.setWireFramedViewEnabled( ! this.isWireFramedViewEnabled);
	},
	
	/**
	 * Enables or disables the transparent view.
	 * @param {Boolean} isEnabled - true, if transparent view should be enabled. false, if transparent view should be disabled.
	 */
	setTransparentViewEnabled: function(isEnabled)
	{
		if(this.isTranparentViewEnabled === isEnabled)
			return;
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var node = nodes[i];
			//set transparent:
			//material #0 (solid material)
			//material #2 (double sided solid material)
			for(var j = 0; j < node.mesh.material.length; j++)
			{
				if(j === 0 || j === 2)
				{
					var material = node.mesh.material[j];
					if(isEnabled)
					{
						material.transparent = true;
						material.opacity = 0.7;
					}
					else
					{
						material.transparent = false;
						material.opacity = 1.0;
					}
				}
			}
		}
		this.isTranparentViewEnabled = isEnabled;
		WebGLViewer.render();
		WebGLViewer.menuBar.setButtonActive("transparent", isEnabled);
	},
	
	/**
	 * Enables the transparent view, if transparent view is disabled.
	 * Disables the transparent view, if transparent view is enabled.
	 */
	toggleTransparentView: function()
	{
		this.setTransparentViewEnabled( ! this.isTranparentViewEnabled);
	},
	
	/**
	 * Informs the scenegraph (3D view), that the color of cad objects may have changed.
	 */
	updateViewAfterColorChange: function()
	{
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var applicationModelNode = nodes[i];
			var geometry = applicationModelNode.mesh.geometry;
			geometry.attributes.color.needsUpdate = true;
		}
		WebGLViewer.render();
	}
};
/**
 * Creates an instance of ApplicationModelNode.
 * @constructor
 * @property {Map(String,CadObject)} guidCadObjectMap - Maps the Guids of the contained cadObject to the related cad objects.
 * @property {THREE.Mesh} mesh - The mesh related to this model node.
 * @property {String} file - The file name for this model.
 */
ApplicationModelNode = function()
{
	this.guidCadObjectMap = {};
	this.vertexStartCadObjectMap = {};
	this.mesh = undefined;
	this.file = undefined;
};

ApplicationModelNode.prototype = 
{
	/**
	 * Adds a cad object to this model.
	 * @param {CadObject} cadObject - The cad object to be added.
	 */
	addCadObject: function(cadObject) 
	{
		this.guidCadObjectMap[cadObject.guid] = cadObject;
		if(cadObject.shapes.length > 0)
		{
			this.vertexStartCadObjectMap[cadObject.shapes[0].vertexStart] = cadObject;
		}
	},
	
	getCadObjectByVertexIndex: function(vertexIndex)
	{
		var prevIndex = -1;
		for(var index in this.vertexStartCadObjectMap)
		{
			if(index > vertexIndex)
			{
				var cadObject = this.vertexStartCadObjectMap[prevIndex];
				return this.vertexStartCadObjectMap[prevIndex];
			}
			prevIndex = index;
		}
		return this.vertexStartCadObjectMap[prevIndex];
	},
	
	/**
	 * Returns the cad objects contained in this model.
	 * @return {CadObject[]} the cad objects.
	 */
	getCadObjects: function()
	{
		var cadObjects = new Array();
		for(var guid in this.guidCadObjectMap)
		{
			cadObjects.push(this.guidCadObjectMap[guid]);
		}
		return cadObjects;
	},
	
	/**
	 * Returns the number of cad objects contained in this model.
	 * @return {Number} the number of cad objects.
	 */
	getCadObjectCount: function()
	{
		return Object.keys(this.guidCadObjectMap).length;
	},
	
	/**
	 * Returns the cad object with the specified GUID
	 * or undefined, if such a cad object is not contained in this model.
	 * @param {String} guid - The GUID of the cad object to be searched.
	 * @return {CadObject} the cad object or undefined.
	 */
	getCadObjectByGuid: function(guid)
	{
		return this.guidCadObjectMap[guid];
	},
	
	/**
	 * Returns the cad object with the specified STEP line number
	 * or undefined, if such a cad object is not contained in this model.
	 * @param {Number} stepnr - The STEP line number of the cad object to be searched.
	 * @return {CadObject} the cad object or undefined.
	 */
	getCadObjectByStepNr: function(stepnr)
	{
		for(var guid in this.guidCadObjectMap)
		{
			if(this.guidCadObjectMap[guid].stepnr === stepnr)
				return this.guidCadObjectMap[guid];
		}
	},
	
	/**
	 * Returns the cad objects of the specified type sorted by STEP line number.
	 * @param {String} type - The type of the objects to be searched (e.g. "IfcWall").
	 * @return {CadObject[]} the cad objects.
	 */
	getCadObjectsOfType: function(type)
	{
		var cadObjects = new Array();
		for(var guid in this.guidCadObjectMap)
		{
			if(this.guidCadObjectMap[guid].type === type)
				cadObjects.push(this.guidCadObjectMap[guid]);
		}
		cadObjects.sort(function(a,b) {
			return a.stepnr - b.stepnr;
		});
		return cadObjects;
	},
	
	/**
	 * Returns all types of cad objects contained in this model sorted alphabetically.
	 * @return {String[]} the types.
	 */
	getTypes: function()
	{
		var map = {};
		for(var guid in this.guidCadObjectMap)
		{
			map[this.guidCadObjectMap[guid].type] = true;
		}
		return Object.keys(map).sort();
	}
};
/**
 * Creates an instance of ApplicationModelRoot.
 * @constructor
 * @property {ApplicationModelNode[]} nodes - The model nodes contained in this model root.
 * @property {Object[]} listeners - The listeners receiving events from this model root.
 * @property {SelectionModel} selectionModel - The selection model.
 * @property {VisibilityModel} visibilityModel - The visibility model.
 * @property {THREE.Vector} offset - The initial offset to be used when a model is loaded.
 */
ApplicationModelRoot = function()
{
	this.nodes = [];
	this.listeners = [];
	this.selectionModel = new SelectionModel();
	this.visibilityModel = new VisibilityModel();
	this.spatialModel = new SpatialModel();
	this.addListener(this.spatialModel);
	this.offset = undefined;
};

ApplicationModelRoot.prototype =
{
	/**
	 * Adds a model node to this model root.
	 * @param {ApplicationModelNode} applicationModelNode - the model node to be added.
	 */
	addNode: function(applicationModelNode)
	{
		this.nodes.push(applicationModelNode);
		this.fireNodeAdded(applicationModelNode);
	},
	
	/**
	 * Removes all model nodes from this model root.
	 */
	clearNodes: function()
	{
		var oldNodes = this.nodes;
		this.nodes = [];
		for(var i = 0; i < oldNodes.length; i++)
		{
			this.fireNodeRemoved(oldNodes[i]);
		}
	},
	
	/**
	 * Returns all model nodes contained in this model root.
	 * @return {ApplicationModelNode[]} the model nodes.
	 */
	getNodes: function()
	{
		return this.nodes;
	},
	
	/**
	 * Returns the model node at the specified index.
	 * @param {Number} index - the index.
	 * @return {ApplicationModelNode} the model node.
	 */
	getNode: function(index)
	{
		return this.nodes[index];
	},
	
	getNodeByMesh: function(mesh)
	{
		for(var i = 0; i < this.nodes.length; i++)
		{
			var aMesh = this.nodes[i].mesh;
			if(mesh === aMesh)
			{
				return this.nodes[i];
			}
		}
		return undefined;
	},
	
	/**
	 * Returns the number of model nodes contained in this model root.
	 * @return {Number} the number of model nodes.
	 */
	getNodeCount: function()
	{
		return this.nodes.length;
	},
	
	/**
	 * Returns the index of the specified model node.
	 * @param {ApplicationModelNode} applicationModelNode - the node to get index for.
	 * @return {Number} the index.
	 */
	indexOf: function(applicationModelNode)
	{
		return this.nodes.indexOf(applicationModelNode);
	},
	
	/**
	 * Removes a model node from this model root.
	 * @param {ApplicationModelNode} applicationModelNode - the node to be removed.
	 */
	removeNode: function(applicationModelNode)
	{
		var index = this.nodes.indexOf(applicationModelNode);
		if(index >= 0)
		{
			this.nodes.splice(index, 1);
			this.fireNodeRemoved(applicationModelNode);
		}
	},
	
	/**
	 * Adds a listener to this model root to get informed, 
	 * when model nodes will be added or removed.
	 * The listeners have to implement the following methods:
	 *   - nodeAdded(ApplicationModelNode)
	 *   - nodeRemoved(ApplicationModelNode)
	 * @param {Object} listener - the listener to be added.
	 */
	addListener: function(listener)
	{
		this.listeners.push(listener);
	},
	
	/**
	 * Removes a listener from this model root.
	 * @param {Object} listener - the listener to be removed.
	 */
	removeListener: function(listener)
	{
		var index = this.listeners.indexOf(listener);
		if(index >= 0)
			this.listeners.splice(index, 1);
	},
	
	/**
	 * @private
	 */
	fireNodeAdded: function(node)
	{
		for(var i = 0; i < this.listeners.length; i++)
		{
			this.listeners[i].nodeAdded(node);
		}
	},
	
	/**
	 * @private
	 */
	fireNodeRemoved: function(node)
	{
		for(var i = 0; i < this.listeners.length; i++)
		{
			this.listeners[i].nodeRemoved(node);
		}
	}
};
/**
 * Creates an instance of CadObject.
 * @constructor
 * @param {ApplicationModelNode} applicationModelNode - the application model node that contains this cad object.
 * @property {ApplicationModelNode} applicationModelNode - the application model node that contains this cad object.
 * @property {Shape[]} shapes - the shapes of this cad object.
 * @property {THREE.Line} edges - the line geometry of the edges of this cad object.
 * @property {Number} edgeColor - the color of the edges of this cad object (default: 0x000000).
 * @property {String} name - the name of this cad object (e.g. "Wall-001").
 * @property {String} guid - the GUID of this cad object.
 * @property {Number} stepnr - the STEP Nr. of this cad object.
 * @property {String} type - the type of this cad object (e.g. "IfcWall").
 * @property {Boolean} isSelected - whether this cad object is selected or not.
 * @property {Boolean} isVisible - whether this cad object is visible or not.
 * @property {Boolean} areEdgesVisible - whether the edges of this cad object are visible or not.
 * @property {Boolean} createEdgesOnVisible - whether edges should be created or not, when this cad object becomes visible again.
 */
CadObject = function(applicationModelNode)
{
	this.applicationModelNode = applicationModelNode;
	this.shapes = [];
	this.edges = undefined;
	this.edgeColor = WebGLViewer.applicationController.DEFAULT_EDGE_COLOR;
	this.edgeRadius = WebGLViewer.applicationController.DEFAULT_EDGE_RADIUS;
	this.name = undefined;
	this.guid = undefined;
	this.stepnr = undefined;
	this.type = undefined;
	this.isSelected = false;
	this.isVisible = true;
	this.areEdgesVisible = false;
	this.createEdgesOnVisible = false;
};

CadObject.prototype = 
{
	/**
	 * Changes the visibility state of this cad object.
	 * @param {Boolean} isVisible - whether cad object should be visible or not.
	 */
	setVisible: function(isVisible)
	{
		for(var i = 0; i < this.shapes.length; i++)
		{
			this.shapes[i].setVisible(isVisible);
		}
		this.isVisible = isVisible;
		if(isVisible && this.createEdgesOnVisible)
		{
			this.createEdges();
		}
		if(this.edges)
		{
			this.edges.material.visible = isVisible && this.areEdgesVisible;
		}
	},
	
	/**
	 * Changes the selection state of this cad object.
	 * @param {Boolean} isSelected - whether cad object should be selected or deselected.
	 */
	setSelected: function(isSelected)
	{
		for(var i = 0; i < this.shapes.length; i++)
		{
			this.shapes[i].setSelected(isSelected);
		}
		this.isSelected = isSelected;
	},
	
	/**
	 * Sets the color of all shapes of this cad object to the specified color.
	 * If the specified color is undefined, the color will be reset to the original color.
	 * After changing the color of one or more objects, call 
	 * WebGLViewer.applicationController.updateViewAfterColorChange();
	 * to update the scenegraph (3D view).
	 * @param {Number} color - The color to be set (e.g. "0xffffff").
	 */
	setColor: function(newColor)
	{
		for(var i = 0; i < this.shapes.length; i++)
		{
			this.shapes[i].setColor(newColor);
		}
	},
	
	/**
	 * Resets the color of all shapes of this cad object to the original color.
	 * After changing the color of one or more objects, call 
	 * WebGLViewer.applicationController.updateViewAfterColorChange();
	 * to update the scenegraph (3D view).
	 */
	resetColor: function()
	{
		for(var i = 0; i < this.shapes.length; i++)
		{
			this.shapes[i].resetColor();
		}
	},
	
	/**
	 * Creates the line geometry of the edges of this cad object, if not present already.
	 * The edges will be generated based on the triangulated surface information.
	 * If this cad object is currently invisible, the edges cannot been created, now.
	 * However, a flag is set that edges will be created, when this object becomes visible again.
	 */
	createEdges: function(edgeRadius)
	{
		//TODO edges bereits auf Server generieren
		
		if(edgeRadius)
			this.edgeRadius = edgeRadius;
		//if object has no shapes, do nothing
		if(this.shapes.length === 0)
		{
			return;
		}
		//if edges already exist, do nothing
		if(this.edges)
		{
			return;
		}
		//if object is invisible create edges, when object becomes visible again
		//edge creating now will not work, since vertices are shrinked together in invisible state!
		if( ! this.isVisible && ! this.edges)
		{
			this.createEdgesOnVisible = true;
			return;
		}
		this.createEdgesOnVisible = false;
		var geometry = new THREE.Geometry();
		var vertices3 = new Array();
		for(var i = 0; i < this.shapes.length; i++)
		{
			var shape = this.shapes[i];
			var edgeMap = {}; // Map<EdgeKeyString="fromIndex>toIndex", Edge>
			
			for(var i = shape.vertexStart; i < shape.vertexEnd; i+=9)
			{
				var x1 = shape.geometry.attributes.position.array[i];
				var y1 = shape.geometry.attributes.position.array[i+1];
				var z1 = shape.geometry.attributes.position.array[i+2];
				var x2 = shape.geometry.attributes.position.array[i+3];
				var y2 = shape.geometry.attributes.position.array[i+4];
				var z2 = shape.geometry.attributes.position.array[i+5];
				var x3 = shape.geometry.attributes.position.array[i+6];
				var y3 = shape.geometry.attributes.position.array[i+7];
				var z3 = shape.geometry.attributes.position.array[i+8];
				var a = new THREE.Vector3(x1, y1, z1);
				var b = new THREE.Vector3(x2, y2, z2);
				var c = new THREE.Vector3(x3, y3, z3);
				var edgeAB = new Edge(a, b);
				var edgeBC = new Edge(b, c);
				var edgeCA = new Edge(c, a);
				if( ! edgeMap.hasOwnProperty(edgeAB.getKey()))
					edgeMap[edgeAB.getKey()] = edgeAB;
				if( ! edgeMap.hasOwnProperty(edgeBC.getKey()))
					edgeMap[edgeBC.getKey()] = edgeBC;
				if( ! edgeMap.hasOwnProperty(edgeCA.getKey()))
					edgeMap[edgeCA.getKey()] = edgeCA;
				edgeMap[edgeAB.getKey()].addPoint3(c);
				edgeMap[edgeBC.getKey()].addPoint3(a);
				edgeMap[edgeCA.getKey()].addPoint3(b);
			}
			var checkedKeys = {};
			for(var edgeKey in edgeMap)
			{
				if(checkedKeys[edgeKey] === true)
					continue;
				var edge = edgeMap[edgeKey];
				var twinKey = edge.getTwinKey();
				var twin = edgeMap[twinKey];
				checkedKeys[edgeKey] = true;
				checkedKeys[twinKey] = true;
				if(!twin)
				{
					//twin edge does not exist -> create edge line
					geometry.vertices.push(edge.p1);
					geometry.vertices.push(edge.p2);
					vertices3.push(edge.p3Array[0]);
				}
				else
				{
					if(edge.p3Array.length > 1 || twin.p3Array.length > 1)
					{
						//multiple faces at this edge -> create edge line
						geometry.vertices.push(edge.p1);
						geometry.vertices.push(edge.p2);
						vertices3.push(edge.p3Array[0]);
					}
					else
					{
						//twin edge exists -> check distance of third point of adjacent triangle
						var a1 = edge.p1;
						var a2 = edge.p2;
						var a3 = edge.p3Array[0];
						var b1 = twin.p1;
						var b2 = twin.p2;
						var b3 = twin.p3Array[0];
						//plane equation
						//E: Ax+By+Cz+D1 = 0
						//   normal = (A,B,C)
						var v1 = new THREE.Vector3();
						var v2 = new THREE.Vector3();
						var normal1 = new THREE.Vector3();
						v1.subVectors(a2, a1);
						v2.subVectors(a3, a1);
						normal1.crossVectors(v1, v2);
						var D1 = - normal1.dot(a1);
						var dist = normal1.dot(b3)+D1;
						//check first, if triangles share same plane
						if(Math.abs(dist) > WebGLViewer.applicationController.CREATE_EDGE_TOLERANCE)
						{
							v1.subVectors(b2, b1);
							v2.subVectors(b3, b1);
							var normal2 = new THREE.Vector3();
							normal2.crossVectors(v1, v2);
							normal1.normalize();
							normal2.normalize();
							var angle = normal1.dot(normal2);
							//then, check angle between planes
							if(angle < WebGLViewer.applicationController.CREATE_EDGE_MAX_ANGLE_VARIATION)
							{
								geometry.vertices.push(edge.p1);
								geometry.vertices.push(edge.p2);
								vertices3.push(edge.p3Array[0]);
							}
						}
					}
				}
			}
		}
		if(this.edgeRadius == undefined)
		{
			var material = new THREE.LineBasicMaterial({color: this.edgeColor});
			//this.edges = new THREE.Line(geometry, material, THREE.LinePieces); //not any longer supported
			this.edges = new THREE.LineSegments(geometry, material);
		}
		else
		{
			var newGeometry = new THREE.Geometry();
			var j = 0;
			for (var i = 0; i < geometry.vertices.length; i+=2) 
			{
				var a1 = geometry.vertices[i];
				var a2 = geometry.vertices[i+1];
				var a3 = vertices3[j++];
				var xAxis = new THREE.Vector3();
				var temp = new THREE.Vector3();
				var zAxis = new THREE.Vector3();
				xAxis.subVectors(a2, a1);
				temp.subVectors(a3, a1);
				xAxis.normalize();
				temp.normalize();
				zAxis.crossVectors(xAxis, temp);
				zAxis.normalize();
				var yAxis = new THREE.Vector3();
				yAxis.crossVectors(xAxis, zAxis);
				yAxis.normalize();
				var radius = this.edgeRadius;
				var length = a1.distanceTo(a2);
				var cylinder = new THREE.CylinderGeometry(radius, radius, length);
				cylinder.applyMatrix(new THREE.Matrix4().makeTranslation(0, length/2, 0));
				cylinder.applyMatrix(new THREE.Matrix4().makeRotationZ(-Math.PI/2));
				var matrix = new THREE.Matrix4();
				matrix.set(	xAxis.x, yAxis.x, zAxis.x, a1.x,
							xAxis.y, yAxis.y, zAxis.y, a1.y,
							xAxis.z, yAxis.z, zAxis.z, a1.z,
							0, 0, 0, 1);
				cylinder.applyMatrix(matrix);
				newGeometry.merge(cylinder);
			}
			var material = new THREE.MeshBasicMaterial({color: this.edgeColor, side: THREE.DoubleSide});
			this.edges = new THREE.Mesh(newGeometry, material);
		}
		this.setEdgesVisible(this.areEdgesVisible);
		WebGLViewer.scene.add(this.edges);
	},
	
	removeEdges: function()
	{
		if(this.edges)
		{
			WebGLViewer.scene.remove(this.edges);
			this.edges = undefined;
		}
	},
	
	/**
	 * Sets the edges of this cad object visible or invisible.
	 * To see the edges in the 3D View, the edges have to be created before calling this method with the method createEdges()!
	 * @param {Boolean} isVisible - true if edges should be visible, false otherwise.
	 */
	setEdgesVisible: function(isVisible) 
	{
		if(this.edges)
		{
			this.edges.material.visible = isVisible && this.isVisible;
		}
		this.areEdgesVisible = isVisible;
	},
	
	/**
	 * Changes the color of the edges of this cad object.
	 * @param {Number} color - the color to be set (e.g. 0x000000)
	 */
	setEdgeColor: function(color)
	{
		if(this.edges)
		{
			this.edges.material.color.setHex(color);
		}
	},
	
	/**
	 * Returns the bounding box of this cad object.
	 * @returns {THREE.Vector3[]} array containing the lower (minX,minY,minZ) and upper (maxX,maxY,maxZ) point of the bounding box.
	 */
	getBoundingBox: function()
	{
		var vertices = this.applicationModelNode.mesh.geometry.vertices;
		var lower = null;
		var upper = null;
		for(var i = 0; i < this.shapes.length; i++)
		{
			var shape = this.shapes[i];
			for(var j = 0; j < shape.faces.length; j++)
			{
				var face = shape.faces[j];
				var vertexA = vertices[face.a];
				if(lower)
				{
					lower.x = Math.min(lower.x, vertexA.x);
					lower.y = Math.min(lower.y, vertexA.y);
					lower.z = Math.min(lower.z, vertexA.z);
					upper.x = Math.max(upper.x, vertexA.x);
					upper.y = Math.max(upper.y, vertexA.y);
					upper.z = Math.max(upper.z, vertexA.z);
				}
				else
				{
					lower = new THREE.Vector3(vertexA.x, vertexA.y, vertexA.z);
					upper = new THREE.Vector3(vertexA.x, vertexA.y, vertexA.z);
				}
				var vertexB = vertices[face.b];
				lower.x = Math.min(lower.x, vertexB.x);
				lower.y = Math.min(lower.y, vertexB.y);
				lower.z = Math.min(lower.z, vertexB.z);
				upper.x = Math.max(upper.x, vertexB.x);
				upper.y = Math.max(upper.y, vertexB.y);
				upper.z = Math.max(upper.z, vertexB.z);
				var vertexC = vertices[face.c];
				lower.x = Math.min(lower.x, vertexC.x);
				lower.y = Math.min(lower.y, vertexC.y);
				lower.z = Math.min(lower.z, vertexC.z);
				upper.x = Math.max(upper.x, vertexC.x);
				upper.y = Math.max(upper.y, vertexC.y);
				upper.z = Math.max(upper.z, vertexC.z);
			}
		}
		var bbox = [];
		bbox[0] = lower;
		bbox[1] = upper;
		return bbox;
	}
};

/**
 * Creates an instance of Edge.
 * Edge is just a helper class and is used only internally.
 * @constructor
 * @param {THREE.Vector3} p1 - the first point 
 * @param {THREE.Vector3} p2 - second point
 * @property {THREE.Vector3[]} p3Array - array of points of triangles located at this edge.
 */
Edge = function(p1, p2)
{
	this.p1 = p1;
	this.p2 = p2;
	this.p3Array = new Array();
};

Edge.prototype =
{
	key: function(p)
	{
		return "("+p.x+","+p.y+","+p.z+")";
	},

	/**
	 * Returns a key describing the edge direction.
	 * @returns {String} the key
	 */
	getKey: function()
	{
		return this.key(this.p1)+">"+this.key(this.p2);
	},
	
	/**
	 * Returns a key describing the edge in opposite direction (the twin edge).
	 * @returns {String} the twin key
	 */
	getTwinKey: function()
	{
		return this.key(this.p2)+">"+this.key(this.p1);
	},
	
	/**
	 * Adds an index of a point of a triangle located at this edge
	 * @param index3
	 */
	addPoint3: function(p3)
	{
		this.p3Array.push(p3);
	}
};
CameraAnimation = function()
{
	this.duration = 500;
	this.steps = 50;
};

CameraAnimation.prototype = 
{
	flyTo: function(cameraPosition, cameraUpVector, cameraDirection)
	{
		if( ! cameraPosition)
		{
			cameraPosition = WebGLViewer.camera.position.clone();
		}
		if( ! cameraUpVector)
		{
			cameraUpVector = camera.up.clone();
		}
		if( ! cameraDirection)
		{
			cameraDirection = new THREE.Vector3(0, 0, -1);
			cameraDirection.applyEuler(WebGLViewer.camera.rotation, WebGLViewer.camera.rotation.order);
		}
		cameraUpVector.normalize();
		cameraDirection.normalize();
		//current camera values
		var currentPos = WebGLViewer.camera.position.clone();
		var currentUp = WebGLViewer.camera.up.clone().normalize();
		var currentDir = new THREE.Vector3(0, 0, -1);
		currentDir.applyEuler(WebGLViewer.camera.rotation, WebGLViewer.camera.rotation.order);
		currentDir.normalize();
		//animation properties
		var duration = this.duration;
		var steps = this.steps;
		var delay = duration/steps;
		//delta position
		var deltaPos = new THREE.Vector3();
		deltaPos.subVectors(cameraPosition, currentPos);
		deltaPos.divideScalar(steps);
		//delta up vector
		var deltaUp = new THREE.Vector3();
		deltaUp.subVectors(cameraUpVector, currentUp);
		deltaUp.divideScalar(steps);
		//delta position
		var deltaDir = new THREE.Vector3();
		deltaDir.subVectors(cameraDirection, currentDir);
		deltaDir.divideScalar(steps);
		//animation function
		var doAnimation = function()
		{
			currentPos.add(deltaPos);
			currentUp.add(deltaUp);
			currentDir.add(deltaDir);
			WebGLViewer.camera.position.set(currentPos.x, currentPos.y, currentPos.z);
			WebGLViewer.camera.up.set(currentUp.x, currentUp.y, currentUp.z);
			var lookAt = new THREE.Vector3();
			lookAt.addVectors(currentPos, currentDir);
			WebGLViewer.camera.lookAt(lookAt);
			WebGLViewer.render();
		};
		for (var i = 0; i < steps; i++)
		{
			setTimeout(doAnimation, i*delay);
		}
	}
}
/**
 * Creates an instance of CameraControls.
 * @constructor
 */
CameraControls = function() 
{
	var camera = WebGLViewer.camera;
	var canvas = WebGLViewer.canvas;
	// self reference for anonymous functions
	var self = this;
	// rotation point
	this.rotationPoint = new THREE.Vector3(0.0, 0.0, 0.0);
	// mouse button controls (0=LEFT, 1=MIDDLE, 2=RIGHT)
	var NONE = -1, ROTATE = 0, ZOOM = 1, PAN = 2;
	// current mouse button pressed state
	var state = NONE;
	// mouse positions [px]
	var xStart = 0, yStart = 0, xEnd = 0, yEnd = 0;
	// change flag
	var isMouseDown = false;
	var isDirty = false;
	var isTouchRunning = false;
	// mouse sensitivities
	var rotateSpeed = 0.01, zoomSpeed = 0.09, panSpeed = 0.09;

	// EXTERNAL methods

	/**
	 * Updates the 3D view.
	 */
	this.update = function() {
		if (!isDirty)
			return;
		if (state === ROTATE) {
			rotateCamera();
		} else if (state === ZOOM) {
			zoomCamera();
		} else if (state === PAN) {
			panCamera();
		}
		xStart = xEnd;
		yStart = yEnd;
		isDirty = false;
		WebGLViewer.render();
	}
	
	/**
	 * Sets the sensitivities for rotating, zooming and panning the model.
	 * @param {Number} _rotateSpeed - the rotate speed to be set (default: 0.01).
	 * @param {Number} _zoomSpeed - the zoom speed to be set (default: 0.09).
	 * @param {Number} _panSpeed - the pan speed to be set (default: 0.09).
	 */
	this.setSensitivities = function(_rotateSpeed, _zoomSpeed, _panSpeed)
	{
		rotateSpeed = _rotateSpeed ? _rotateSpeed : 0.01;
		zoomSpeed = _zoomSpeed ? _zoomSpeed : 0.09;
		panSpeed = _panSpeed ? _panSpeed : 0.09;
		if(WebGLViewer.DEBUG) console.log("rotateSpeed: "+rotateSpeed);
		if(WebGLViewer.DEBUG) console.log("zoomSpeed: "+zoomSpeed);
		if(WebGLViewer.DEBUG) console.log("panSpeed: "+panSpeed);
	}
	
	this.setEnabled = function(isEnabled)
	{
		if(isEnabled)
		{
			//register mouse events
			canvas.addEventListener('contextmenu', contextmenu, false);
			canvas.addEventListener('mousedown', mousedown, false);
			canvas.addEventListener('mouseup', mouseup, false);
			canvas.addEventListener('mouseout', mouseout, false);
			canvas.addEventListener('mousemove', mousemove, false);
			canvas.addEventListener('mousewheel', mousewheel, false);
			canvas.addEventListener('DOMMouseScroll', mousewheel, false); // firefox
			//register touch events
			canvas.addEventListener( 'touchstart', touchstart, false );
			canvas.addEventListener( 'touchend', touchend, false );
			canvas.addEventListener( 'touchmove', touchmove, false );
		}
		else
		{
			//unregister mouse events
			canvas.removeEventListener('contextmenu', contextmenu, false);
			canvas.removeEventListener('mousedown', mousedown, false);
			canvas.removeEventListener('mouseup', mouseup, false);
			canvas.removeEventListener('mouseout', mouseout, false);
			canvas.removeEventListener('mousemove', mousemove, false);
			canvas.removeEventListener('mousewheel', mousewheel, false);
			canvas.removeEventListener('DOMMouseScroll', mousewheel, false); // firefox
			//unregister touch events
			canvas.removeEventListener( 'touchstart', touchstart, false );
			canvas.removeEventListener( 'touchend', touchend, false );
			canvas.removeEventListener( 'touchmove', touchmove, false );
		}
	}

	// INTERNAL methods

	function rotateCamera() 
	{
		var cameraLookVector = new THREE.Vector3(0, 0, -1);
		cameraLookVector.applyEuler(camera.rotation, camera.rotation.order);
		var cameraUpVector = camera.up.clone().normalize();
		var cameraSideVector = (new THREE.Vector3()).crossVectors(
				cameraLookVector, cameraUpVector).normalize();
		var cameraPosition = camera.position.clone();
		cameraPosition.sub(self.rotationPoint);
		var angleX = (xEnd - xStart) * rotateSpeed;
		var angleY = (yEnd - yStart) * rotateSpeed;

		var vec1 = new THREE.Vector3(self.rotationPoint.x - cameraPosition.x,
				self.rotationPoint.y - cameraPosition.y, self.rotationPoint.z
						- cameraPosition.z);
		var quat1 = new THREE.Quaternion();
		//Rotation around lokal Y-Axis
		var axis1 = cameraSideVector.clone();
		quat1.setFromAxisAngle(axis1, -angleY);
		cameraPosition.applyQuaternion(quat1);
		cameraUpVector.applyQuaternion(quat1);
		
		cameraLookVector.applyQuaternion(quat1);
		var lookAt = new THREE.Vector3();

		vec1 = new THREE.Vector3(self.rotationPoint.x - cameraPosition.x,
				self.rotationPoint.y - cameraPosition.y, self.rotationPoint.z
						- cameraPosition.z);
		quat1 = new THREE.Quaternion();
		//Rotation around screen X-Axis (parallel to Canvas)
		axis1 = new THREE.Vector3(0,0,1);
		quat1.setFromAxisAngle(axis1, -angleX);
		cameraPosition.applyQuaternion(quat1);
		cameraUpVector.applyQuaternion(quat1);
		
		// move back
		cameraPosition.add(self.rotationPoint);
		camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
		cameraLookVector.applyQuaternion(quat1);
		lookAt = new THREE.Vector3();
		lookAt.addVectors(cameraPosition, cameraLookVector);
		camera.up = cameraUpVector;
		camera.lookAt(lookAt);
	}

	function zoomCamera() 
	{
		var cameraLookVector = new THREE.Vector3(0, 0, -1);
		cameraLookVector.applyEuler(camera.rotation, camera.rotation.order);
		var cameraPosition = camera.position.clone();
		var dy = (yStart - yEnd) * zoomSpeed;
		cameraPosition.add(cameraLookVector.setLength(dy));
		camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
	}

	function panCamera() 
	{
		var cameraLookVector = new THREE.Vector3(0, 0, -1);
		cameraLookVector.applyEuler(camera.rotation, camera.rotation.order);
		var cameraUpVector = camera.up.clone().normalize();
		var cameraSideVector = (new THREE.Vector3()).crossVectors(
				cameraLookVector, cameraUpVector).normalize();
		var cameraPosition = camera.position.clone();
		var dx = (xStart - xEnd) * panSpeed;
		var dy = (yEnd - yStart) * panSpeed;
		cameraPosition.add(cameraSideVector.setLength(dx));
		cameraPosition.add(cameraUpVector.setLength(dy));
		camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
	}

	function preventDefault(event) 
	{
		event.preventDefault();
		//event.stopPropagation();
	}

	function mousedown(event) 
	{
		preventDefault(event);
		xStart = xEnd = event.clientX;
		yStart = yEnd = event.clientY;
		isDirty = false;
		isMouseDown = true;
		if(event.button === 0 && event.ctrlKey)
		{
			state = PAN;
		}
		else if(event.button === 0 && event.shiftKey)
		{
			state = ZOOM;
		}
		else
		{
			state = event.button;
		}
	}

	function mousemove(event) 
	{
		if(isMouseDown)
		{
			preventDefault(event);
			isDirty = true;
			xEnd = event.clientX;
			yEnd = event.clientY;
		}
	}
	
	function mouseout(event)
	{
		if(isMouseDown)
		{
			preventDefault(event);
			isMouseDown = false;
		}
	}

	function mouseup(event) 
	{
		if(isMouseDown)
		{
			preventDefault(event);
			isDirty = true;
			isMouseDown = false;
			xEnd = event.clientX;
			yEnd = event.clientY;
		}
	}

	function mousewheel(event) 
	{
		preventDefault(event);
		isDirty = true;
		state = ZOOM;
		var delta = 0;
		// WebKit / Opera / Explorer 9
		if (event.wheelDelta) {
			delta = event.wheelDelta;
		}
		// Firefox
		else if (event.detail) {
			delta = -event.detail;
		}
		yStart = delta;
		yEnd = 0;
	}

	function contextmenu(event) 
	{
		preventDefault(event);
	}
	
	function touchstart(event) 
	{
//		preventDefault(event);
		//don't start new touch event as long one finger remains on display
		if(isTouchRunning)
			return;
		//one finger touch: rotate
		if(event.touches.length === 1)
		{
			state = ROTATE;
			xStart = xEnd = event.touches[0].pageX;
			yStart = yEnd = event.touches[0].pageY;
		}
		//two finger touch: zoom
		else if(event.touches.length === 2)
		{
			state = ZOOM;
			var dx = event.touches[0].pageX - event.touches[1].pageX;
			var dy = event.touches[0].pageY - event.touches[1].pageY;
			var distance = Math.sqrt( dx * dx + dy * dy );
			xStart = xEnd = 0;
			yStart = yEnd = -distance;
		}
		//three finger touch: pan
		else if(event.touches.length === 3)
		{
			state = PAN;
			xStart = xEnd = event.touches[0].pageX;
			yStart = yEnd = event.touches[0].pageY;
		}
		else
		{
			state = NONE;
		}
		isDirty = false;
	}
	
	function touchmove(event) 
	{
		preventDefault(event);
		//don't process new touch event as long one finger remains on display
		if(isTouchRunning)
			return;
		//one finger touch: rotate
		if(event.touches.length === 1)
		{
			xEnd = event.touches[0].pageX;
			yEnd = event.touches[0].pageY;
		}
		//two finger touch: zoom
		else if(event.touches.length === 2)
		{
			var dx = event.touches[0].pageX - event.touches[1].pageX;
			var dy = event.touches[0].pageY - event.touches[1].pageY;
			var distance = Math.sqrt( dx * dx + dy * dy );
			xEnd = 0;
			yEnd = -distance;
		}
		//three finger touch: pan
		else if(event.touches.length === 3)
		{
			xEnd = event.touches[0].pageX;
			yEnd = event.touches[0].pageY;
		}
		isDirty = true;
	}
	
	function touchend(event) 
	{
		preventDefault(event);
		isTouchRunning = event.touches.length > 0;
	}
};
/**
 * Creates an instance of CameraControls.
 * @constructor
 */
CameraControlsWalkMode = function() 
{
	var camera = WebGLViewer.camera;
	var canvas = WebGLViewer.canvas;
	// self reference for anonymous functions
	var self = this;
	// mouse button controls (0=LEFT, 1=MIDDLE, 2=RIGHT)
	var NONE = -1, ROTATE = 0, ZOOM = 1, PAN = 2;
	// current mouse button pressed state
	var state = NONE;
	// mouse positions [px]
	var xStart = 0, yStart = 0, xEnd = 0, yEnd = 0;
	// keyboard actions
	var moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, moveUp = false, moveDown = false;
	var rotateLeft = false, rotateRight = false, rotateUp = false, rotateDown = false;
	var clock = new THREE.Clock();
	// change flag
	var isMouseDown = false;
	var isDirty = false;
	var isTouchRunning = false;
	// mouse sensitivities
	var rotateSpeed = 0.008, zoomSpeed = 0.1, panSpeed = 0.05;
	// keyboard sensitivities
	var keyboardMoveSpeed = 10.0, keyboardRotateSpeed = 1.0;

	// EXTERNAL methods

	/**
	 * Updates the 3D view.
	 */
	this.update = function() 
	{
		if (isKeyPressed())
		{
			adjustCamera();
			WebGLViewer.render();
		}
		if (isDirty)
		{
			if (state === ROTATE) 
			{
				rotateCamera();
			}
			else if (state === ZOOM) 
			{
				zoomCamera();
			} 
			else if (state === PAN) 
			{
				panCamera();
			}
			xStart = xEnd;
			yStart = yEnd;
			isDirty = false;
			WebGLViewer.render();
		}
	}
	
	/**
	 * Sets the sensitivities for rotating, zooming and panning the model.
	 * @param {Number} _rotateSpeed - the rotate speed to be set (default: 0.01).
	 * @param {Number} _zoomSpeed - the zoom speed to be set (default: 0.09).
	 * @param {Number} _panSpeed - the pan speed to be set (default: 0.09).
	 */
	this.setSensitivities = function(_rotateSpeed, _zoomSpeed, _panSpeed)
	{
		//TODO sensitivities
//		rotateSpeed = _rotateSpeed ? _rotateSpeed : 0.01;
//		zoomSpeed = _zoomSpeed ? _zoomSpeed : 0.09;
//		panSpeed = _panSpeed ? _panSpeed : 0.09;
//		if(WebGLViewer.DEBUG) console.log("rotateSpeed: "+rotateSpeed);
//		if(WebGLViewer.DEBUG) console.log("zoomSpeed: "+zoomSpeed);
//		if(WebGLViewer.DEBUG) console.log("panSpeed: "+panSpeed);
	}
	
	this.setEnabled = function(isEnabled)
	{
		if(isEnabled)
		{
			//register mouse events
			canvas.addEventListener('contextmenu', contextmenu, false);
			canvas.addEventListener('mousedown', mousedown, false);
			canvas.addEventListener('mouseup', mouseup, false);
			canvas.addEventListener('mouseout', mouseout, false);
			canvas.addEventListener('mousemove', mousemove, false);
			canvas.addEventListener('mousewheel', mousewheel, false);
			canvas.addEventListener('DOMMouseScroll', mousewheel, false); // firefox
			//register touch events
			canvas.addEventListener( 'touchstart', touchstart, false );
			canvas.addEventListener( 'touchend', touchend, false );
			canvas.addEventListener( 'touchmove', touchmove, false );
			//register keyboard events
			window.addEventListener( 'keydown', keydown, false );
			window.addEventListener( 'keyup', keyup, false );
		}
		else
		{
			//unregister mouse events
			canvas.removeEventListener('contextmenu', contextmenu, false);
			canvas.removeEventListener('mousedown', mousedown, false);
			canvas.removeEventListener('mouseup', mouseup, false);
			canvas.removeEventListener('mouseout', mouseout, false);
			canvas.removeEventListener('mousemove', mousemove, false);
			canvas.removeEventListener('mousewheel', mousewheel, false);
			canvas.removeEventListener('DOMMouseScroll', mousewheel, false); // firefox
			//unregister touch events
			canvas.removeEventListener( 'touchstart', touchstart, false );
			canvas.removeEventListener( 'touchend', touchend, false );
			canvas.removeEventListener( 'touchmove', touchmove, false );
			//unregister keyboard events
			window.removeEventListener( 'keydown', keydown, false );
			window.removeEventListener( 'keyup', keyup, false );
		}
	}

	// INTERNAL methods
	
	function isKeyPressed()
	{
		return moveForward || moveBackward || moveLeft || moveRight || moveUp || moveDown || rotateLeft || rotateRight || rotateUp || rotateDown;
	}
	
	function adjustCamera()
	{
		var delta = clock.getDelta();
		if(moveForward || moveBackward)
		{
			var cameraLookVector = new THREE.Vector3(0, 0, -1);
			cameraLookVector.applyEuler(camera.rotation, camera.rotation.order);
			cameraLookVector.setZ(0);
			cameraLookVector.normalize();
			var cameraPosition = camera.position.clone();
			var dx = delta * keyboardMoveSpeed;
			if(moveBackward)
				dx *= -1;
			cameraPosition.add(cameraLookVector.setLength(dx));
			camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
		}
		if(moveLeft || moveRight)
		{
			var cameraLookVector = new THREE.Vector3(0, 0, -1);
			cameraLookVector.applyEuler(camera.rotation, camera.rotation.order);
			cameraLookVector.normalize();
			var cameraUpVector = camera.up.clone().normalize();
			var cameraSideVector = (new THREE.Vector3()).crossVectors(cameraLookVector, cameraUpVector).normalize();
			var cameraPosition = camera.position.clone();
			var dy = delta * keyboardMoveSpeed;
			if(moveLeft)
				dy *= -1;
			cameraPosition.add(cameraSideVector.setLength(dy));
			camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
		}
		if(moveUp || moveDown)
		{
			var upVector = new THREE.Vector3(0, 0, 1);
			var cameraPosition = camera.position.clone();
			var dz = delta * keyboardMoveSpeed;
			if(moveDown)
				dz *= -1;
			cameraPosition.add(upVector.setLength(dz));
			camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
		}
		if(rotateLeft || rotateRight)
		{
			var angle = delta * keyboardRotateSpeed;
			if(rotateRight)
				angle *= -1;
			var axis1 = new THREE.Vector3(0,0,1);
			var quat1 = new THREE.Quaternion();
			quat1.setFromAxisAngle(axis1, angle);
			var cameraLookVector = new THREE.Vector3(0, 0, -1);
			cameraLookVector.applyEuler(camera.rotation, camera.rotation.order);
			cameraLookVector.normalize();
			var cameraUpVector = camera.up.clone().normalize();
			var cameraSideVector = (new THREE.Vector3()).crossVectors(cameraLookVector, cameraUpVector).normalize();
			var cameraPosition = camera.position.clone();
			cameraUpVector.applyQuaternion(quat1);
			cameraLookVector.applyQuaternion(quat1);
			lookAt = new THREE.Vector3();
			lookAt.addVectors(cameraPosition, cameraLookVector);
			camera.up = cameraUpVector;
			camera.lookAt(lookAt);
		}
		if(rotateUp || rotateDown)
		{
			var angle = delta * keyboardRotateSpeed;
			if(rotateDown)
				angle *= -1;
			var cameraLookVector = new THREE.Vector3(0, 0, -1);
			cameraLookVector.applyEuler(camera.rotation, camera.rotation.order);
			cameraLookVector.normalize();
			var cameraUpVector = camera.up.clone().normalize();
			var cameraSideVector = (new THREE.Vector3()).crossVectors(cameraLookVector, cameraUpVector).normalize();
			var cameraPosition = camera.position.clone();
			var quat1 = new THREE.Quaternion();
			quat1.setFromAxisAngle(cameraSideVector, angle);
			cameraUpVector.applyQuaternion(quat1);
			cameraLookVector.applyQuaternion(quat1);
			lookAt = new THREE.Vector3();
			lookAt.addVectors(cameraPosition, cameraLookVector);
			camera.up = cameraUpVector;
			camera.lookAt(lookAt);
		}
	}

	function rotateCamera() 
	{
		var angleX = (xEnd - xStart) * rotateSpeed;
		var angleY = (yEnd - yStart) * rotateSpeed;
		var cameraLookVector = new THREE.Vector3(0, 0, -1);
		cameraLookVector.applyEuler(camera.rotation, camera.rotation.order);
		var cameraUpVector = camera.up.clone().normalize();
		var cameraSideVector = (new THREE.Vector3()).crossVectors(cameraLookVector, cameraUpVector).normalize();
		var cameraPosition = camera.position.clone();
		//Rotation around local Y-Axis
		var quat1 = new THREE.Quaternion();
		quat1.setFromAxisAngle(cameraSideVector, -angleY);
		cameraUpVector.applyQuaternion(quat1);
		cameraLookVector.applyQuaternion(quat1);
		//Rotation around screen X-Axis (parallel to Canvas)
		var axis1 = new THREE.Vector3(0,0,1);
		quat1.setFromAxisAngle(axis1, -angleX);
		cameraUpVector.applyQuaternion(quat1);
		cameraLookVector.applyQuaternion(quat1);
		var lookAt = new THREE.Vector3();
		lookAt.addVectors(cameraPosition, cameraLookVector);
		camera.up = cameraUpVector;
		camera.lookAt(lookAt);
	}

	function zoomCamera() 
	{
		var cameraLookVector = new THREE.Vector3(0, 0, -1);
		cameraLookVector.applyEuler(camera.rotation, camera.rotation.order);
		cameraLookVector.setZ(0)
		cameraLookVector.normalize();
		var cameraPosition = camera.position.clone();
		var dy = (yStart - yEnd) * zoomSpeed;
		cameraPosition.add(cameraLookVector.setLength(dy));
		camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
	}

	function panCamera() 
	{
		var cameraLookVector = new THREE.Vector3(0, 0, -1);
		cameraLookVector.applyEuler(camera.rotation, camera.rotation.order);
		cameraLookVector.setZ(0);
		cameraLookVector.normalize();
		var cameraUpVector = new THREE.Vector3(0, 0, 1);
		var cameraSideVector = (new THREE.Vector3()).crossVectors(
				cameraLookVector, cameraUpVector).normalize();
		var cameraPosition = camera.position.clone();
		var dx = (xStart - xEnd) * panSpeed;
		var dy = (yEnd - yStart) * panSpeed;
		cameraPosition.add(cameraSideVector.setLength(dx));
		cameraPosition.add(cameraUpVector.setLength(dy));
		camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
	}

	function preventDefault(event) 
	{
		event.preventDefault();
		//event.stopPropagation();
	}
	
	function keydown(event)
	{
		switch(event.keyCode)
		{
		//MOVE FORWARD
		case 87: /*W*/
		case 38: /*arrow-up*/
		case 104: /*Num 8*/
			moveForward = true;
			clock.getDelta();//reset clock delta
			break;
		//MOVE BACKWARD
		case 83: /*S*/
		case 40: /*arrow-down*/
		case 98: /*Num 2*/
			moveBackward = true;
			clock.getDelta();//reset clock delta
			break;
		//MOVE LEFT
		case 81: /*Q*/
		case 103: /*Num 7*/
			moveLeft = true;
			clock.getDelta();//reset clock delta
			break;
		//MOVE RIGHT
		case 69: /*E*/
		case 105: /*Num 9*/
			moveRight = true;
			clock.getDelta();//reset clock delta
			break;
		//MOVE UP
		case 82: /*R*/
		case 33: /*page-up*/
		case 107: /*Num +*/
			moveUp = true;
			clock.getDelta();//reset clock delta
			break;
		//MOVE DOWN
		case 70: /*F*/
		case 34: /*page-down*/
		case 109: /*Num -*/
			moveDown = true;
			clock.getDelta();//reset clock delta
			break;
		//ROTATE LEFT
		case 65: /*A*/
		case 37: /*arrow-left*/
		case 100: /*Num 4*/
			rotateLeft = true;
			clock.getDelta();//reset clock delta
			break;
		//ROTATE RIGHT
		case 68: /*D*/
		case 39: /*arrow-right*/
		case 102: /*Num 6*/
			rotateRight = true;
			clock.getDelta();//reset clock delta
			break;
		//ROTATE UP
		case 84: /*T*/
		case 97: /*Num 1*/
			rotateUp = true;
			clock.getDelta();//reset clock delta
			break;
		//ROTATE DOWN
		case 71: /*G*/
		case 99: /*Num 3*/
			rotateDown = true;
			clock.getDelta();//reset clock delta
			break;
		default:
			//console.log("keycode="+event.keyCode);
			break;
		}
	}
	
	function keyup(event)
	{
		switch(event.keyCode)
		{
		//MOVE FORWARD
		case 87: /*W*/
		case 38: /*arrow-up*/
		case 104: /*Num 8*/
			moveForward = false;
			break;
		//MOVE BACKWARD
		case 83: /*S*/
		case 40: /*arrow-down*/
		case 98: /*Num 2*/
			moveBackward = false;
			break;
		//MOVE LEFT
		case 81: /*Q*/
		case 103: /*Num 7*/
			moveLeft = false;
			break;
		//MOVE RIGHT
		case 69: /*E*/
		case 105: /*Num 9*/
			moveRight = false;
			break;
		//MOVE UP
		case 82: /*R*/
		case 33: /*page-up*/
		case 107: /*Num +*/
			moveUp = false;
			break;
		//MOVE DOWN
		case 70: /*F*/
		case 34: /*page-down*/
		case 109: /*Num -*/
			moveDown = false;
			break;
		//ROTATE LEFT
		case 65: /*A*/
		case 37: /*arrow-left*/
		case 100: /*Num 4*/
			rotateLeft = false;
			break;
		//ROTATE RIGHT
		case 68: /*D*/
		case 39: /*arrow-right*/
		case 102: /*Num 6*/
			rotateRight = false;
			break;
		//ROTATE UP
		case 84: /*T*/
		case 97: /*Num 1*/
			rotateUp = false;
			break;
		//ROTATE DOWN
		case 71: /*G*/
		case 99: /*Num 3*/
			rotateDown = false;
			break;
		default:
			break;
		}
	}

	function mousedown(event) 
	{
		preventDefault(event);
		xStart = xEnd = event.clientX;
		yStart = yEnd = event.clientY;
		isDirty = false;
		isMouseDown = true;
		if(event.button === 0 && event.ctrlKey)
		{
			state = PAN;
		}
		else if(event.button === 0 && event.shiftKey)
		{
			state = ZOOM;
		}
		else
		{
			state = event.button;
		}
	}

	function mousemove(event) 
	{
		if(isMouseDown)
		{
			preventDefault(event);
			isDirty = true;
			xEnd = event.clientX;
			yEnd = event.clientY;
		}
	}
	
	function mouseout(event)
	{
		if(isMouseDown)
		{
			preventDefault(event);
			isMouseDown = false;
		}
	}

	function mouseup(event) 
	{
		if(isMouseDown)
		{
			preventDefault(event);
			isDirty = true;
			isMouseDown = false;
			xEnd = event.clientX;
			yEnd = event.clientY;
		}
	}

	function mousewheel(event) 
	{
		preventDefault(event);
		isDirty = true;
		state = ZOOM;
		var delta = 0;
		// WebKit / Opera / Explorer 9
		if (event.wheelDelta) {
			delta = event.wheelDelta;
		}
		// Firefox
		else if (event.detail) {
			delta = -event.detail;
		}
		yStart = delta;
		yEnd = 0;
	}

	function contextmenu(event) 
	{
		preventDefault(event);
	}
	
	function touchstart(event) 
	{
//		preventDefault(event);
		//don't start new touch event as long one finger remains on display
		if(isTouchRunning)
			return;
		//one finger touch: rotate
		if(event.touches.length === 1)
		{
			state = ROTATE;
			xStart = xEnd = event.touches[0].pageX;
			yStart = yEnd = event.touches[0].pageY;
		}
		//two finger touch: zoom
		else if(event.touches.length === 2)
		{
			state = ZOOM;
			var dx = event.touches[0].pageX - event.touches[1].pageX;
			var dy = event.touches[0].pageY - event.touches[1].pageY;
			var distance = Math.sqrt( dx * dx + dy * dy );
			xStart = xEnd = 0;
			yStart = yEnd = -distance;
		}
		//three finger touch: pan
		else if(event.touches.length === 3)
		{
			state = PAN;
			xStart = xEnd = event.touches[0].pageX;
			yStart = yEnd = event.touches[0].pageY;
		}
		else
		{
			state = NONE;
		}
		isDirty = false;
	}
	
	function touchmove(event) 
	{
		preventDefault(event);
		//don't process new touch event as long one finger remains on display
		if(isTouchRunning)
			return;
		//one finger touch: rotate
		if(event.touches.length === 1)
		{
			xEnd = event.touches[0].pageX;
			yEnd = event.touches[0].pageY;
		}
		//two finger touch: zoom
		else if(event.touches.length === 2)
		{
			var dx = event.touches[0].pageX - event.touches[1].pageX;
			var dy = event.touches[0].pageY - event.touches[1].pageY;
			var distance = Math.sqrt( dx * dx + dy * dy );
			xEnd = 0;
			yEnd = -distance;
		}
		//three finger touch: pan
		else if(event.touches.length === 3)
		{
			xEnd = event.touches[0].pageX;
			yEnd = event.touches[0].pageY;
		}
		isDirty = true;
	}
	
	function touchend(event) 
	{
		preventDefault(event);
		isTouchRunning = event.touches.length > 0;
	}
};
/**
 * Creates an instance of CameraControls.
 * @constructor
 * @param {THREE.PerspectiveCamera} camera - the camera for the view.
 */
CameraHelper = function()
{
	this.IS_ANIMATION_ENABLED = true;
	this.FIT_IN_CORRECTION_FACTOR = 1.2;
};

CameraHelper.prototype =
{	
	/**
	 * Returns an array of points containing the lower and the upper point
	 * of the scene's bounding box
	 * @return the scene's bounding box: Vector3[] {lowerPoint, upperPoint}
	 */
	getSceneBoundingBox: function()
	{
		var lower = null;
		var upper = null;
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var j = 0; j < nodes.length; j++)
		{
			var mesh = nodes[j].mesh;
			mesh.geometry.computeBoundingBox();
			if(mesh.geometry.boundingBox)
			{
				var min = mesh.geometry.boundingBox.min;
				var max = mesh.geometry.boundingBox.max;
				if(lower)
				{
					lower.x = Math.min(lower.x, min.x);
					lower.y = Math.min(lower.y, min.y);
					lower.z = Math.min(lower.z, min.z);
				}
				else
				{
					lower = new THREE.Vector3(min.x, min.y, min.z);
				}
				if(upper)
				{
					upper.x = Math.max(upper.x, max.x);
					upper.y = Math.max(upper.y, max.y);
					upper.z = Math.max(upper.z, max.z);
				}
				else
				{
					upper = new THREE.Vector3(max.x, max.y, max.z);
				}
			}
		}
		var bbox = [];
		bbox[0] = lower;
		bbox[1] = upper;
		if(lower != null && upper != null)
		{
			if(WebGLViewer.DEBUG) console.log("BoundingBox.lower: ("+lower.x+", "+lower.y+", "+lower.z+")");
			if(WebGLViewer.DEBUG) console.log("BoundingBox.upper: ("+upper.x+", "+upper.y+", "+upper.z+")");
		}
		return bbox;
	},
	
	fitInScene: function(isAnimated)
	{
		isAnimated = isAnimated != undefined ? isAnimated : this.IS_ANIMATION_ENABLED;
		//compute bounding box
		var bbox = this.getSceneBoundingBox();
		this.fitInBoundingBox(bbox, isAnimated);
		return bbox;
	},
	
	fitInCadObjectByGuid: function(guid, isAnimated)
	{
		isAnimated = isAnimated != undefined ? isAnimated : this.IS_ANIMATION_ENABLED;
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var cadObject = nodes[i].getCadObjectByGuid(guid);
			if(cadObject)
			{
				this.fitInCadObject(cadObject, isAnimated);
				break;
			}
		}
	},
	
	fitInCadObject: function(cadObject, isAnimated)
	{
		isAnimated = isAnimated != undefined ? isAnimated : this.IS_ANIMATION_ENABLED;
		var bbox = cadObject.getBoundingBox();
		this.fitInBoundingBox(bbox, isAnimated);
	},
	
	fitInBoundingBox: function(bbox, isAnimated)
	{
		isAnimated = isAnimated != undefined ? isAnimated : this.IS_ANIMATION_ENABLED;
		var fitInVectors = this.computeFitInVectors(bbox);
		var newPos = fitInVectors[0];
		var lookAt = fitInVectors[1];
		if(isAnimated)
		{
			new CameraView("temp", newPos).applyView(isAnimated);
		}
		else
		{
			WebGLViewer.camera.position.set(newPos.x, newPos.y, newPos.z);
			WebGLViewer.camera.lookAt(lookAt);
			WebGLViewer.render();
		}
	},
	
	setViewFromTop: function()
	{
		var scale = 1.0;
		var boundingBox = WebGLViewer.cameraHelper.getSceneBoundingBox();
		this.setViewFromTopBBox(boundingBox);
	},
	
	setViewFromTopBBox: function(boundingBox)
	{
		var lower = boundingBox[0];
		var upper = boundingBox[1];
		if(!lower || !upper)
		{
			var d = 5;
			lower = new THREE.Vector3(-d, -d, -d);
			upper = new THREE.Vector3(d, d, d);
		}
		//compute center of bounding box
		var center = new THREE.Vector3();
		center.x = (upper.x + lower.x) * 0.5;
		center.y = (upper.y + lower.y) * 0.5;
		center.z = (upper.z + lower.z) * 0.5;
		var dx = (upper.x - lower.x) / 2;
		var dy = (upper.y - lower.y) / 2;
		var dz = (upper.z - lower.z) / 2;
		var ratio = WebGLViewer.camera.aspect;
		var fov = WebGLViewer.camera.fov * Math.PI / 180.0 / 2.0;
		var tanfov = Math.tan(fov);
		var dist1 = dx / (ratio * tanfov);
		var dist2 = dy / tanfov;
		// distance to fit in field of view
		var dist = Math.max(dist1, dist2);
		var newPosition = new THREE.Vector3(center.x, center.y, center.z + dz + dist);
		var cameraUpVector = new THREE.Vector3(0, 1, 0);
		var cameraDirection = new THREE.Vector3(0, 0, -1);
		WebGLViewer.cameraAnimation.flyTo(newPosition, cameraUpVector, cameraDirection);
	},
	
	computeFitInVectors: function(bbox)
	{
		var min = bbox[0];
		var max = bbox[1];
		if(!min || !max)
		{
			var d = 5;
			min = new THREE.Vector3(-d, -d, -d);
			max = new THREE.Vector3(d, d, d);
		}
		//compute center of bounding box
		var center = new THREE.Vector3();
		center.x = (max.x + min.x) * 0.5;
		center.y = (max.y + min.y) * 0.5;
		center.z = (max.z + min.z) * 0.5;
		//compute distance
		var diag = new THREE.Vector3();
		diag = diag.subVectors(max, min);
		var radius = diag.length() * 0.5;
		var fov = WebGLViewer.camera.fov * Math.PI / 180.0 / 2.0;
		var tanfov = Math.tan(fov);
		var ratio = WebGLViewer.camera.aspect;
		var cameraDirection = new THREE.Vector3(0, 0, -1);
		cameraDirection.applyEuler(WebGLViewer.camera.rotation, WebGLViewer.camera.rotation.order);
		cameraDirection.multiplyScalar(-1);
		var offset = radius / (ratio * tanfov);
		cameraDirection.setLength(offset*this.FIT_IN_CORRECTION_FACTOR);
		var newPos = new THREE.Vector3();
		newPos.addVectors(center, cameraDirection);
		var fitInVectors = new Array();
		fitInVectors[0] = newPos;
		fitInVectors[1] = center;
		return fitInVectors;
	}
};
/**
 * Creates a new Check Box Tree. After setting up the tree structure,
 * call toHTML()-method of the tree to generate the HTML code and add the returned HTML-code
 * to your HTML-container. Afterwards, call initCallbacks()-method to register the callbacks
 * to the generated HTML-components.
 * @constructor
 * @param {String} treeID - an unique ID used to identify the HTML components of this tree.
 * @param {CheckBoxTreeNode} root - the root node of the tree.
 * @param {Boolean} isRootVisible - whether root should be visible or not [optional, default: true].
 * @param {Boolean} autoUpdateChildren - whether state of childs of a node should be updated (selected/checked), when selection/visibility event occurs, or not [optional, default: true]
 * @param {Boolean} autoUpdateParent - whether state of the parent of a node should be updated (selected/checked), when selection/visibility event occurs, or not [optional, default: true]
 * @property {CheckBoxTreeNodeIconManager} iconManager - the icon manager for icons in the tree.
 */
CheckBoxTree = function(treeID, root, isRootVisible, autoUpdateChildren, autoUpdateParent)
{
	this.treeID = treeID;
	this.root = root;
	this.isRootVisible = isRootVisible === undefined ? true : isRootVisible;
	this.autoUpdateChildren = autoUpdateChildren === undefined ? true : autoUpdateChildren;
	this.autoUpdateParent = autoUpdateParent === undefined ? true : autoUpdateParent;
	this.iconManager = new CheckBoxTreeNodeIconManager(this.isRootVisible);
};

CheckBoxTree.prototype = 
{
	/**
	 * Registers the callbacks at the HTML-components (e.g. neccesary to expand/collapse/select/check a node).
	 * Before calling this method, call toHTML() and add the generated code to your HTML-container!
	 */
	initCallbacks: function()
	{
		this.root.initExpandCallBack();
		this.root.initCheckBoxCallBack();
		this.root.initSelectionCallBack();
	},
	
	/**
	 * Generates the HTML-code of the complete tree that should be added to your HTML-container.
	 * @return {String} the generated HTML-code
	 */
	toHTML: function()
	{
		var content = "<div id='"+this.treeID+"' class='checkboxtree'>";
		content += this.root.toHTML(this);
		content += "</div>";
		return content;
	}
};
/** counter used for unique ID of a CheckBoxTreeNode */
var _nodeCounter = 0;

/**
 * Creates a new checkbox tree node.
 * @constructor
 * @param {String} title - the title of the node used for the node's alphanumeric representation in the tree.
 * @param {Boolean} isExpanded - whether node should be expanded by default or not [optional, default: false].
 * @property {Number} nodeID - TODO
 * @property {CheckBoxTreeNode} parent - TODO
 * @property {CheckBoxTreeNode[]} childs - TODO
 * @property {Method} checkBoxCallback - TODO
 * @property {Method} selectionCallback - TODO
 * @property {Boolean} isSelected - TODO
 * @property {Boolean} isVisible - TODO
 * @property {CheckBoxTree} tree - TODO
 * @property {Object} userObject - TODO
 */
function CheckBoxTreeNode(title, isExpanded)
{
	this.title = title;
	this.isExpanded = isExpanded === undefined ? false : isExpanded;
	this.nodeID = _nodeCounter++;
	this.parent = undefined;
	this.childs = new Array();
	this.checkBoxCallback = undefined;
	this.selectionCallback = undefined;
	this.expansionCallback = undefined;
	this.isSelected = false;
	this.isVisible = true;
	this.tree = undefined;
	this.userObject = undefined;
}

CheckBoxTreeNode.prototype =
{
	/**
	 * Adds a child node to this node. This node is registered as parent for the child.
	 * @param {CheckBoxTreeNode} child - the child node to be added.
	 */
	addChild: function(child)
	{
		this.childs.push(child);
		child.parent = this;
	},
	
	removeChild: function(child)
	{
		var index = this.childs.indexOf(child);
		if(index >= 0)
		{
			this.childs.splice(index, 1);
			var id = "div_"+this.tree.treeID+"_"+child.nodeID;
			var div = document.getElementById(id);
			if(div)
			{
				div.parentNode.removeChild(div);
			}
		}
	},
	
	/**
	 * Returns the child nodes of this node.
	 * @return {CheckBoxTreeNode[]} the child nodes.
	 */
	getChilds: function()
	{
		return this.childs;
	},
	
	/**
	 * Returns the child count of this node.
	 * @return {Number} the child count.
	 */
	getChildCount: function()
	{
		return this.childs.length;
	},
	
	/**
	 * Returns whether this node has child nodes or not.
	 * @return {Boolean} true, if node has childs.
	 */
	hasChilds: function()
	{
		return this.childs.length > 0;
	},
	
	/**
	 * Returns the node path as array of nodes, starting with this node over the parent nodes toward root node,
	 * e.g. [this-node, parent-node, grand-parent-node, root-node].
	 * @return {CheckBoxTreeNode[]} the node path.
	 */
	getNodePath: function()
	{
		var path = new Array();
		path.push(this);
		var currentNode = this;
		while(currentNode.parent !== undefined)
		{
			path.push(currentNode.parent);
			currentNode = currentNode.parent;
		}
		return path;
	},
	
	/**
	 * Returns whether the specified child is the first child of this node.
	 * @param {CheckBoxTreeNode} child - the child to be tested.
	 * @return {Boolean} true, if child is the first child.
	 */
	isFirstChild: function(child)
	{
		if(this.childs.length === 0)
			return false;
		return this.childs[0] === child;
	},
	
	/**
	 * Returns whether the specified child is the last child of this node.
	 * @param {CheckBoxTreeNode} child - the child to be tested.
	 * @return {Boolean} true, if child is the last child.
	 */
	isLastChild: function(child)
	{
		if(this.childs.length === 0)
			return false;
		return this.childs[this.childs.length-1] === child;
	},
	
	/**
	 * Returns whether this node is the root node.
	 * @param {Boolean} true, if this node is the root node.
	 */
	isRoot: function()
	{
		return this.parent === undefined;
	},
	
	/**
	 * Expands/Collapses this node. In detail:
	 * - the visibility of the childs' div-containers is set to "block"/"none"
	 * - the expand icon of the node will be changed to "minus"/"plus" icon, if node has children
	 * @param {Boolean} isExpanded - whether node should be expanded (true) or collapsed (false) [optional, default: true]
	 */
	setExpanded: function(isExpanded)
	{
		this.isExpanded = isExpanded === undefined ? true : isExpanded;
		//hide/show children
		for(var i = 0; i < this.childs.length; i++)
		{
			var child = this.childs[i];
			var div = document.getElementById("div_"+this.tree.treeID+"_"+child.nodeID);
			div.style.display = this.isExpanded ? "block" : "none";
		}
		//change icon
		var img = document.getElementById("img_"+this.tree.treeID+"_"+this.nodeID);
		img.src = this.tree.iconManager.getExpandedIcon(this);
	},
	
	/**
	 * Selects/Deselects this node. In detail:
	 * - the CSS class name of the title component is set to selected/deselected state
	 * - the childs of this node will be selected/deselected, if specified
	 * - the parent of this node will be deselected, if this node was deselected, if specified
	 * - the parent of this node will be selected, if all childs of the parent are now selected, if specified
	 * @param {Boolean} isSelected - whether this node should be selected (true) or deselected (false) [optional, default: true]
	 * @param {Boolean} updateChildren whether the childs of this node should be updated or not [optional, default: true]
	 * @param {Boolean} updateParent whether the parent of this node should be updated or not [optional, default: true]
	 */
	setSelected: function(isSelected, updateChildren, updateParent)
	{
		var _isSelected = isSelected === undefined ? true : isSelected;
		var _updateChildren = updateChildren === undefined ? true : updateChildren;
		var _updateParent = updateParent === undefined ? true : updateParent;
		this.isSelected = _isSelected;
		var a = document.getElementById("a_"+this.tree.treeID+"_"+this.nodeID);
		if(a)
		{
			a.className = this.isSelected ? "nodeSel" : "node";
		}
		if(_updateChildren)
		{
			for(var i = 0; i < this.childs.length; i++)
			{
				var child = this.childs[i];
				child.setSelected(_isSelected, true, false);
			}
		}
		if(_updateParent)
		{
			if( ! this.isRoot())
			{
				if( ! _isSelected)
				{
					this.parent.setSelected(false, false, true);
				}
				else
				{
					//check childs of parent, if all are selected
					var areAllChildsSelected = true;
					for(var i = 0; i < this.parent.childs.length; i++)
					{
						if( ! this.parent.childs[i].isSelected)
						{
							areAllChildsSelected = false;
							break;
						}
					}
					if(areAllChildsSelected)
					{
						this.parent.setSelected(true, false, true);
					}
				}
			}
		}
	},
	
	/**
	 * Checks/Unchecks the checkbox of this node. In detail:
	 * - the checkbox will be selected/deselected
	 * - the checkboxes of the childs of this node will be selected/deselected, if specified
	 * - the checkbox of the parent of this node will be selected, if this node was checked, if specified
	 * - the parent of this node will be deselected, if at least one child of the parent is now unchecked, if specified
	 * @param {Boolean} isVisible - whether this node should be checked or not [optional, default: true]
	 * @param {Boolean} updateChildren - whether the childs of this node should be updated or not [optional, default: true]
	 * @param {Boolean} updateParent - whether the parent of this node should be updated or not [optional, default: true]
	 */
	setVisible: function(isVisible, updateChildren, updateParent)
	{
		var _isVisible = isVisible === undefined ? true : isVisible;
		var _updateChildren = updateChildren === undefined ? true : updateChildren;
		var _updateParent = updateParent === undefined ? true : updateParent;
		this.isVisible = _isVisible;
		var checkbox = document.getElementById("cb_"+this.tree.treeID+"_"+this.nodeID);
		if(checkbox)
		{
			checkbox.checked = _isVisible;
		}
		if(_updateChildren)
		{
			for(var i = 0; i < this.childs.length; i++)
			{
				var child = this.childs[i];
				child.setVisible(_isVisible, true, false);
			}
		}
		if(_updateParent)
		{
			if( ! this.isRoot())
			{
				if(_isVisible)
				{
					this.parent.setVisible(true, false, true);
				}
				else
				{
					//check childs of parent, if at least one is visible
					var isChildVisible = false;
					for(var i = 0; i < this.parent.childs.length; i++)
					{
						if(this.parent.childs[i].isVisible)
						{
							isChildVisible = true;
							break;
						}
					}
					if( ! isChildVisible)
					{
						this.parent.setVisible(false, false, true);
					}
				}
			}
		}
	},
	
	/**
	 * Registers the expand/collapse callback method at the plus/minus icon of this node.
	 * Forwards the request to all children.
	 */
	initExpandCallBack: function()
	{
		if(this.getChildCount() > 0)
		{
			var img = document.getElementById("img_"+this.tree.treeID+"_"+this.nodeID);
			if(img)
			{
				var self = this;
				img.onclick = function() {
					if(self.expansionCallback !== undefined)
					{
						self.expansionCallback( ! self.isExpanded);
					}
					self.setExpanded( ! self.isExpanded);
				};
			}
			for(var i = 0; i < this.childs.length; i++)
			{
				var child = this.childs[i];
				child.initExpandCallBack();
			}
		}
	},
	
	/**
	 * Registers the checkbox callback method at the checkbox component of this node.
	 * Forwards the request to all children.
	 */
	initCheckBoxCallBack: function()
	{
		var checkbox = document.getElementById("cb_"+this.tree.treeID+"_"+this.nodeID);
		if(checkbox)
		{
			var self = this;
			checkbox.onchange = function() {
				self.setVisible(checkbox.checked, self.tree.autoUpdateChildren, self.tree.autoUpdateParent);
				if(self.checkBoxCallback !== undefined)
				{
					self.checkBoxCallback(checkbox.checked);
				}
			};
		}
		for(var i = 0; i < this.childs.length; i++)
		{
			var child = this.childs[i];
			child.initCheckBoxCallBack();
		}
	},
	
	/**
	 * Registers the selection callback method at the title component of this node.
	 * Forwards the request to all children.
	 */
	initSelectionCallBack: function()
	{
		var a = document.getElementById("a_"+this.tree.treeID+"_"+this.nodeID);
		if(a)
		{
			var self = this;
			a.onclick = function() {
				var isSelected = ! self.isSelected;
				self.setSelected(isSelected, self.tree.autoUpdateChildren, self.tree.autoUpdateParent);
				if(self.selectionCallback !== undefined)
				{
					self.selectionCallback(isSelected);
				}
			};
		}
		for(var i = 0; i < this.childs.length; i++)
		{
			var child = this.childs[i];
			child.initSelectionCallBack();
		}
	},
	
	/**
	 * Updates the node after removing and/or adding new nodes at runtime.
	 */
	update: function()
	{
		var id = "div_"+this.tree.treeID+"_"+this.nodeID;
		var div = document.getElementById(id);
		if(div)
		{
			div.innerHTML = this.toHTMLInnerContent();
		}
		this.initExpandCallBack();
		this.initCheckBoxCallBack();
		this.initSelectionCallBack();
	},
	
	/**
	 * Generates the inner HTML-code of this node's DIV element (and its childs).
	 * @return {String} the generated HTML-code.
	 */
	toHTMLInnerContent: function()
	{
		var content = "";
		var nodePath = this.getNodePath();
		if(nodePath.length > 1)
		{
			var indent = this.tree.isRootVisible ? 0 : 1;
			for(var i = nodePath.length-1-indent; i > 0; i--)
			{
				var icon;
				if(nodePath[i].isRoot())
				{
					icon = this.tree.iconManager.getEmptyIcon();
				}
				else if(nodePath[i].parent.isLastChild(nodePath[i]))
				{
					icon = this.tree.iconManager.getEmptyIcon();
				}
				else
				{
					icon = this.tree.iconManager.getLineIcon();
				}
				content += "<img src='"+icon+"' alt=''>";
			}
		}
		if( ! (this.isRoot() && ! this.tree.isRootVisible))
		{
			content += "<img id='img_"+this.tree.treeID+"_"+this.nodeID+"' src='"+this.tree.iconManager.getExpandedIcon(this)+"' alt=''>";
			content += "<input type='checkbox' id='cb_"+this.tree.treeID+"_"+this.nodeID+"' checked>&nbsp;";
			if(this.hasChilds())
				content += "<a href='#' class='node' id='a_"+this.tree.treeID+"_"+this.nodeID+"'>"+this.title+"</a>"+" ("+this.childs.length+")";
			else
				content += "<a href='#' class='node' id='a_"+this.tree.treeID+"_"+this.nodeID+"'>"+this.title+"</a>";
				
			//quick hack: white space added after title, since title will get partially invisible, when scrollbar appears
			content += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
		}
		for(var i = 0; i < this.childs.length; i++)
		{
			var child = this.childs[i];
			content += child.toHTML(this.tree);
		}
		return content;
	},
	
	/**
	 * Generates the HTML-code of this node (and its childs).
	 * @return {String} the generated HTML-code.
	 */
	toHTML: function(tree)
	{
		this.tree = tree;
		var display = (this.isRoot() || this.parent.isExpanded) ? "block" : "none";
		var content = "<div style='display:"+display+";' id='div_"+this.tree.treeID+"_"+this.nodeID+"'>";
		content += this.toHTMLInnerContent();
		content += "</div>";
		return content;
	}
};
function CheckBoxTreeNodeIconManager(isRootVisible)
{
	this.isRootVisible = isRootVisible;
	this.empty = 'icons/tree/empty.gif';
	this.line = 'icons/tree/line.gif';
	this.join = 'icons/tree/join.gif';
	this.joinTop = 'icons/tree/jointop.gif';
	this.joinBottom = 'icons/tree/joinbottom.gif';
	this.plus = 'icons/tree/plus.gif';
	this.plusTop = 'icons/tree/plustop.gif';
	this.plusRoot = 'icons/tree/plusroot.gif';
	this.plusBottom = 'icons/tree/plusbottom.gif';
	this.minus = 'icons/tree/minus.gif';
	this.minusTop = 'icons/tree/minustop.gif';
	this.minusRoot = 'icons/tree/minusroot.gif';
	this.minusBottom = 'icons/tree/minusbottom.gif';
}

CheckBoxTreeNodeIconManager.prototype =
{
	getExpandedIcon: function(treeNode)
	{
		if(treeNode.isExpanded)
		{
			if( ! treeNode.hasChilds())
			{
				if(treeNode.isRoot())
				{
					return this.empty;
				}
				else if( ! this.isRootVisible && 
						treeNode.parent.isRoot() &&
						treeNode.parent.isFirstChild(treeNode))
				{
					return this.joinTop;
				}
				else if(treeNode.parent.isLastChild(treeNode))
				{
					return this.joinBottom;
				}
				else
				{
					return this.join;
				}
			}
			else
			{
				if(treeNode.isRoot())
				{
					return this.minusRoot;
				}
				else if( ! this.isRootVisible && 
						treeNode.parent.isRoot() &&
						treeNode.parent.isFirstChild(treeNode))
				{
					return this.minusTop;
				}
				else if(treeNode.parent.isLastChild(treeNode))
				{
					return this.minusBottom;
				}
				else
				{
					return this.minus;
				}
			}
		}
		else
		{
			if( ! treeNode.hasChilds())
			{
				if(treeNode.isRoot())
				{
					return this.empty;
				}
				else if( ! this.isRootVisible && 
						treeNode.parent.isRoot() &&
						treeNode.parent.isFirstChild(treeNode))
				{
					return this.joinTop;
				}
				else if(treeNode.parent.isLastChild(treeNode))
				{
					return this.joinBottom;
				}
				else
				{
					return this.join;
				}
			}
			else
			{
				if(treeNode.isRoot())
				{
					return this.plusRoot;
				}
				else if( ! this.isRootVisible && 
						treeNode.parent.isRoot() &&
						treeNode.parent.isFirstChild(treeNode))
				{
					return this.plusTop;
				}
				else if(treeNode.parent.isLastChild(treeNode))
				{
					return this.plusBottom;
				}
				else
				{
					return this.plus;
				}
			}
		}
	},
	
	getEmptyIcon: function()
	{
		return this.empty;
	},
	
	getLineIcon: function()
	{
		return this.line;
	}
};
Grid = function()
{
	this.isVisible = true;
	this.lines = undefined;
};

Grid.prototype =
{
	addToScene: function(scene)
	{
		if(this.lines)
			scene.add(this.lines);
	},
	
	removeFromScene: function(scene)
	{
		if(this.lines)
			scene.remove(this.lines);
	},
	
	setVisible: function(isVisible)
	{
		if( ! this.lines)
			return;
		if(isVisible === this.isVisible)
			return;
		if(isVisible)
			this.addToScene(WebGLViewer.scene);
		else
			this.removeFromScene(WebGLViewer.scene);
		this.isVisible = isVisible;
		WebGLViewer.render();
		WebGLViewer.menuBar.setButtonActive("grid", isVisible);
	},
	
	update: function(xStart, yStart, xEnd, yEnd, majorTick, minorTick)
	{
		xStart = xStart ? xStart : -5;
		yStart = yStart ? yStart : -5;
		xEnd = xEnd ? xEnd : 5;
		yEnd = yEnd ? yEnd : 5;
		majorTick = majorTick ? majorTick : 1;
		minorTick = minorTick ? minorTick : 0.2;
		this.removeFromScene(WebGLViewer.scene);
		var geometry = new THREE.Geometry();
		var darkGray = new THREE.Color(0x555555);
		var lightGray = new THREE.Color(0xaaaaaa);
		var TOL = 1e-5;
		for(var x = xStart; x < xEnd+TOL; x += majorTick)
		{
			geometry.vertices.push(new THREE.Vector3(x, yStart, 0));
			geometry.vertices.push(new THREE.Vector3(x, yEnd, 0));
			geometry.colors.push(darkGray);
			geometry.colors.push(darkGray);
			if(x+minorTick < xEnd)
			{
				for(var x2 = (x+minorTick); x2 < (x+majorTick-TOL); x2 += minorTick)
				{
					geometry.vertices.push(new THREE.Vector3(x2, yStart, 0));
					geometry.vertices.push(new THREE.Vector3(x2, yEnd, 0));
					geometry.colors.push(lightGray);
					geometry.colors.push(lightGray);
				}
			}
		}
		for(var y = yStart; y <= yEnd+TOL; y += majorTick)
		{
			geometry.vertices.push(new THREE.Vector3(xStart, y, 0));
			geometry.vertices.push(new THREE.Vector3(xEnd, y, 0));
			geometry.colors.push(darkGray);
			geometry.colors.push(darkGray);
			if(y+minorTick < yEnd)
			{
				for(var y2 = (y+minorTick); y2 < (y+majorTick-TOL); y2 += minorTick)
				{
					geometry.vertices.push(new THREE.Vector3(xStart, y2, 0));
					geometry.vertices.push(new THREE.Vector3(xEnd, y2, 0));
					geometry.colors.push(lightGray);
					geometry.colors.push(lightGray);
				}
			}
		}
		var material = new THREE.LineBasicMaterial({vertexColors: THREE.VertexColors});
		//this.lines = new THREE.Line(geometry, material, THREE.LinePieces); //not any longer supported
		this.lines = new THREE.LineSegments(geometry, material);
		if(this.isVisible)
			this.addToScene(WebGLViewer.scene);
		WebGLViewer.render();
	}
}
/**
 * Creates an instance of LoadingInfoView.
 * @constructor
 * @property {String} id - The ID of this view.
*/
LoadingInfoView = function()
{
	this.id = "loadinginfoview";
	this.init();
};

LoadingInfoView.prototype =
{
	/**
	 * Initializes the view.
	 * @private
	 */
	init: function()
	{
		var loadView = WebGLViewer.menuBar.getElementById(this.id);
		if(loadView)
		{
			var content = "<b>Loading File...</b>";
			loadView.innerHTML = content;
		}
		WebGLViewer.menuBar.addView(this);
	},

	/**
	 * Changes the visibility of the view.
	 * @param {Boolean} isVisible - true, if view should be visible, otherwise false.
	 */
	setVisible: function(isVisible)
	{
		var loadView = WebGLViewer.menuBar.getElementById(this.id);
		if(loadView)
		{
			if(isVisible)
				loadView.style.display = 'block';
			else
				loadView.style.display = 'none';
		}
	},
};
/**
 * Creates an instance of MenuBar 
 * that is a container that handles the visibilty of views (shows/hides views).
 * Register views via addView(myView) method.
 * The registered views must have an attribute id [type: String] that corresponds with the id of the HTML container.
 * If there is a button, that should be activated, when clicked, the ID of the button must be: view.id+"_button" .
 * @constructor
 * @property {Object[]} views - the views to be handled by this menu bar.
 */
MenuBar = function()
{
	this.views = new Array();
};

MenuBar.prototype = 
{
	/**
	 * Adds and registers a view to this menu bar.
	 * @param {Object} view - the view to be added.
	 */
	addView: function(view)
	{
		if(this.isPopupView(view.id))
			this.views.push(view);
	},
	
	isPopupView: function(id)
	{
		var element = document.getElementById(id+"-popup");
		if(element)
			return true;
		return false;
	},
	
	getElementById: function(id)
	{
		var element = document.getElementById(id);
		if( ! element)
		{
			element = document.getElementById(id+"-popup");
		}
		return element;
	},
	
	/**
	 * The view with the specified view ID will be set visible, if it is currently invisible.
	 * Otherwise it will be hidden.
	 * All other registered views will be hidden.
	 * @param {String} id - the ID of the view to be set visible.
	 */
	showView: function(id)
	{
		var theView = undefined;
		for (var i = 0; i < this.views.length; i++)
		{
			var view = this.views[i];
			if(view.id === id)
			{
				theView = view;
				//activate/deactivate this button
				this.setButtonActiveView(id, ! this.isViewVisible(id));
				//hide/show this view
				this.setViewVisible(id, ! this.isViewVisible(id));
			}
			else
			{
				//deactivate other buttons
				this.setButtonActiveView(view.id, false);
				//hide other views
				this.setViewVisible(view.id, false);
			}
		}
		//if view is not registered
		if(!theView)
		{
			var element = this.getElementById(id);
			if(element)
			{
				//activate/deactivate this button
				this.setButtonActiveView(id, ! this.isElementVisible(element));
				//hide/show this element
				this.setElementVisible(element, ! this.isElementVisible(element));
			}
		}
	},
	
	/**
	 * The view with the specified view ID will be set visible, if it is currently invisible.
	 * Otherwise it will be hidden.
	 * @param {String} id - the ID of the view to be set visible.
	 */
	showPopup: function(id)
	{
		var element = this.getElementById(id);
		//activate/deactivate this button
		this.setButtonActiveView(id, ! this.isElementVisible(element));
		//hide/show this view
		this.setElementVisible(element, ! this.isElementVisible(element));
	},
	
	/**
	 * Sets the specified view visible or invisible.
	 * @param {Object} view - the view to be set visible or invisible.
	 * @param {Boolean} isVisible - whether view should be set visible or invisible.
	 */
	setViewVisible: function(id, isVisible)
	{
		var element = this.getElementById(id);
		this.setElementVisible(element, isVisible);
	},
	
	setElementVisible: function(element, isVisible)
	{
		if(element)
		{
			if(isVisible)
			{
				element.style.display = 'block';
			}
			else
			{
				element.style.display = 'none';
			}
		}
	},
	
	isViewVisible: function(id)
	{
		var element = this.getElementById(id);
		return this.isElementVisible(element);
	},
	
	/**
	 * Returns whether the specified view is visible or invisible.
	 * @param {Object} view - the view to be tested.
	 * @return {Boolean} whether the view is visible or invisible.
	 */
	isElementVisible: function(element)
	{
		if(element)
		{
			return element.style.display === 'block';
		}
		else
		{
			return false;
		}
	},
	
	/**
	 * Sets the related button for the view active or neutral.
	 * @param {String} id - the view's ID related to the button to be set active.
	 * @param {Boolean} isActive - whether button should be set active or neutral.
	 */
	setButtonActive: function(id, isActive)
	{
		var button = document.getElementById(id+"_button");
		if(button)
		{
			var iconStyle = button.className;
			iconStyle = iconStyle.substring(iconStyle.indexOf(" "));
			button.className = isActive ? "buttonActive "+iconStyle : "button "+iconStyle;
		}
	},
	
	/**
	 * Sets the related button for the view active or neutral.
	 * @param {String} id - the view's ID related to the button to be set active.
	 * @param {Boolean} isActive - whether button should be set active or neutral.
	 */
	setButtonActiveView: function(id, isActive)
	{
		var button = document.getElementById(id+"_button");
		if(button)
		{
			var iconStyle = button.className;
			iconStyle = iconStyle.substring(iconStyle.indexOf(" "));
			button.className = isActive ? "buttonActiveView "+iconStyle : "button "+iconStyle;
		}
	}
};
/**
 * Creates an instance of MouseUtils.
 * @constructor
 */
MouseUtils = function()
{
	//no attributes
};

MouseUtils.prototype = 
{
	/**
	 * Returns true, if left mouse button was pressed.
	 * @param {Event} event - the mouse event.
	 * @return {Boolean} whether left mouse button was pressed or not.
	 */
	isLeftMouseButton: function(event)
	{
		// all browsers except IE before version 9
		return event.which == 1;
	},
	
	/**
	 * Returns true, if middle mouse button was pressed.
	 * @param {Event} event - the mouse event.
	 * @return {Boolean} whether middle mouse button was pressed or not.
	 */
	isMiddleMouseButton: function(event)
	{
		// all browsers except IE before version 9
		return event.which == 2;
	},
	
	/**
	 * Returns true, if right mouse button was pressed.
	 * @param {Event} event - the mouse event.
	 * @return {Boolean} whether right mouse button was pressed or not.
	 */
	isRightMouseButton: function(event)
	{
		// all browsers except IE before version 9
		return event.which == 3;
	}
};
/**
 * Creates an instance of ObjectLoader.
 * @constructor
 */
ObjectLoader = function()
{
	//no attributes
};

ObjectLoader.prototype =
{
	/**
	 * Loads the specified geometry JSON file ("*_geometry.js"). The loader will be executed within a new thread.
	 * @param {String} path - the path to the file to be loaded (e.g. "fileupload/myfile.ifc_geometry.js")
	 * @param {String} modelName - the name of the model to be loaded (e.g. "myfile.ifc")
	 */
	loadFileInThread: function(path, modelName)
	{
		var self = this;
		WebGLViewer.loadingInfoView.setVisible(true);
		WebGLViewer.statusBar.setText("Loading "+modelName+"...");
		var thread = function()
		{
			try
			{
				self.loadFile(path, modelName);
			}
			catch(e)
			{
				WebGLViewer.loadingInfoView.setVisible(false);
				WebGLViewer.statusBar.setText("Error: "+e.message);
			}
		};
		setTimeout(thread, 100);
	},
	
	/**
	 * Loads the specified geometry JSON file ("*_geometry.js").
	 * @param {String} path - the path to the file to be loaded (e.g. "fileupload/myfile.ifc_geometry.js")
	 * @param {String} modelName - the name of the model to be loaded (e.g. "myfile.ifc")
	 */
	loadFile: function(path, modelName)
	{
		console.log("Loading File: "+path+", Model: "+modelName);
		var time1 = new Date().getTime();
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = path;
		script.charset = "UTF-8";
		var self = this;
		script.onload = function()
		{
			//parse json object model
			var jsonGeometryModel = JSON.parse(jsongeometry);
			var jsonSpatialModel = JSON.parse(jsonspatial);
			//delete json string
			delete jsongeometry;
			delete jsonspatial;
			var time2 = new Date().getTime();
//			console.log("parseJSON: "+(time2-time1)+"ms");
			self.debugResult("parseJSON: "+(time2-time1)+"ms, ");
			self.loadModel(modelName, jsonGeometryModel, jsonSpatialModel);
		};
		document.head.appendChild(script);
	},
	
	/**
	 * Loads the specified zipped geometry JSON file.
	 * @param {String} path - the path to the zipped file to be loaded (e.g. "fileupload/myfile.ifc_geometry.jszip")
	 * @param {String} modelName - the name of the model to be loaded (e.g. "myfile.ifc")
	 */
	loadZipFileInThread: function(path, modelName)
	{
		var self = this;
		WebGLViewer.loadingInfoView.setVisible(true);
		var thread = function()
		{
			try
			{
				self.loadZipFile(path, modelName);
			}
			catch(e)
			{
				WebGLViewer.loadingInfoView.setVisible(false);
				WebGLViewer.statusBar.setText("Error: "+e.message);
			}
		};
		setTimeout(thread, 100);
	},
	
	/**
	 * Loads the specified zipped geometry JSON file. The loader will be executed within a new thread.
	 * @param {String} path - the path to the zipped file to be loaded (e.g. "fileupload/myfile.ifc_geometry.jszip")
	 * @param {String} modelName - the name of the model to be loaded (e.g. "myfile.ifc")
	 */
	loadZipFile: function(path, modelName)
	{
		console.log("Loading ZIP File: "+path+", Model: "+modelName);
		var req = new XMLHttpRequest();
		req.open("GET", path, true);
		req.responseType = "arraybuffer";
		var self = this;
		req.onload = function(event){
			var arrayBuffer = req.response;
			if(arrayBuffer)
			{
				var byteArray = new Uint8Array(arrayBuffer);
				var zip = new JSZip(byteArray);
				var text = zip.file("geometry.js").asText();
				eval(text);
				//parse json object model
				var jsonGeometryModel = JSON.parse(jsongeometry);
				var jsonSpatialModel = JSON.parse(jsonspatial);
				//delete json string
				delete jsongeometry;
				delete jsonspatial;
				self.loadModel(modelName, jsonGeometryModel, jsonSpatialModel);
			}
		}
		req.send(null);
	},
	
	/**
	 * Loads the specified JSON model.
	 * @param {String} modelName - the name of the model to be loaded (e.g. "myfile.ifc")
	 * @param {Object} jsonGeometryModel - the JSON object model describing the geometry
	 * @param {Object} jsonSpatialModel - the JSON object model describing the spatial structure
	 */
	loadModel: function(modelName, jsonGeometryModel, jsonSpatialModel)
	{
		console.log("START load model");
		var time1 = new Date().getTime(); 
		var scene = WebGLViewer.scene;
		var applicationModelNode = new ApplicationModelNode();
		var geometry = new THREE.BufferGeometry();
		//TODO XMLHttpRequest für JSON
		//TODO zwei oder drei Dateien anlegen für JSON (Geometrie, Semantik, Spatial)
		//TODO initial offset (Center of Bounding box): via Export from IFC converter
		var vertices;
		var colors;
		if(jsonGeometryModel.TriangleCount)
		{
			var triangleCount = jsonGeometryModel.TriangleCount;
			vertices = new Array(triangleCount*3);
			colors = new Array(triangleCount*3);
		}
		else
		{
			vertices = new Array();
			colors = new Array();
		}
		var i = 0;
		var j = 0;
		var k = 0;
		var objectCount = jsonGeometryModel.IfcObjects.length;
		var shapeCount = 0;
		var triangleCount = 0;
		var r = 0;
		var g = 0;
		var b = 0;
		var vindex = 0;
		var cindex = 0;
		for (i = 0; i < objectCount; i++)
		{
			//create cad object
			var object = jsonGeometryModel.IfcObjects[i];
			var cadObject = new CadObject(applicationModelNode);
			//read and set IFC object's parameters
			if(object.Name)
			{
				cadObject.name = object.Name;
			}
			cadObject.type = object.Type;
			cadObject.guid = object.GUID;
			cadObject.stepnr = object.STEPNr;
			//read geometry
			var jsonShapes = object.Shapes;
			shapeCount = jsonShapes.length;
			var shapes = new Array(shapeCount);
			var sindex = 0;
			//for each shape
			for (j = 0; j < shapeCount; j++)
			{
				var jsonShape = jsonShapes[j];
				var triangles = jsonShape.Triangles;
				triangleCount = triangles.length;
				var shape = new Shape(geometry);
				shape.vertexStart = vindex;
				shape.vertexEnd = vindex + triangleCount*9;
				//add group
				var isTransparent = jsonShape.Transparent;
				var isDoubleSided = jsonShape.CullingDisabled;
				var materialIndex = this.getMaterialIndex(isTransparent, isDoubleSided);
				geometry.addGroup(shape.vertexStart/3, triangleCount*3, materialIndex);
				//set color
				shape.color = jsonShape.Color;
				shapes[sindex++] = shape;
				var shapeVertices = jsonShape.Vertices;
				r = shape.color[0];
				g = shape.color[1];
				b = shape.color[2];
				//for each triangle
				for (k = 0; k < triangleCount; k++)
				{
					var triangle = triangles[k];
					var v0 = shapeVertices[triangle[0]];
					var v1 = shapeVertices[triangle[1]];
					var v2 = shapeVertices[triangle[2]];
					vertices[vindex++] = v0[0];
					vertices[vindex++] = v0[1];
					vertices[vindex++] = v0[2];
					colors[cindex++] = r;
					colors[cindex++] = g;
					colors[cindex++] = b;
					vertices[vindex++] = v1[0];
					vertices[vindex++] = v1[1];
					vertices[vindex++] = v1[2];
					colors[cindex++] = r;
					colors[cindex++] = g;
					colors[cindex++] = b;
					vertices[vindex++] = v2[0];
					vertices[vindex++] = v2[1];
					vertices[vindex++] = v2[2];
					colors[cindex++] = r;
					colors[cindex++] = g;
					colors[cindex++] = b;
				}
			}
			cadObject.shapes = shapes;
			applicationModelNode.addCadObject(cadObject);
		}
		var verticesArray = new Float32Array(vertices);
		var colorArray = new Float32Array(colors);
		geometry.addAttribute('position', new THREE.BufferAttribute(verticesArray, 3));
		geometry.addAttribute('color', new THREE.BufferAttribute(colorArray, 3));
		geometry.computeVertexNormals();
		var mesh = new THREE.Mesh(geometry, this.createMaterials());
		scene.add(mesh);
		applicationModelNode.mesh = mesh;
		applicationModelNode.file = modelName;
		applicationModelNode._jsonSpatialModel = jsonSpatialModel;
		WebGLViewer.applicationModelRoot.addNode(applicationModelNode);
		applicationModelNode._jsonSpatialModel = undefined;
		var bbox = WebGLViewer.cameraHelper.fitInScene(false);
		this.updateScene(bbox);
		WebGLViewer.loadingInfoView.setVisible(false);
		WebGLViewer.render();
		var time2 = new Date().getTime();
//		console.log("loadModel: "+(time2-time1)+"ms");
		this.debugResult("loadModel: "+(time2-time1)+"ms");
		console.log("END load model");
	},
	
	debugResult: function(text)
	{
		var debugBar = WebGLViewer.menuBar.getElementById("debugbar");
		if(debugBar)
		{
			debugBar.innerHTML += text;
		}
	},
	
	calculateInitialOffset: function(jsonGeometryModel)
	{
		//calculate offset only for first model -> offset for all models loaded later must be the same
		if(WebGLViewer.applicationModelRoot.getNodeCount() === 0)
		{
			var lower = null;
			for (var i = 0; i < jsonGeometryModel.IfcObjects.length; i++)
			{
				for (var j = 0; j < jsonGeometryModel.IfcObjects[i].Shapes.length; j++)
				{
					for (var k = 0; k < jsonGeometryModel.IfcObjects[i].Shapes[j].Vertices.length; k++)
					{
						var vertex = jsonGeometryModel.IfcObjects[i].Shapes[j].Vertices[k];
						var point = new THREE.Vector3(vertex[0], vertex[1], vertex[2]);
						if(lower)
						{
							lower.x = Math.min(lower.x, point.x);
							lower.y = Math.min(lower.y, point.y);
							lower.z = Math.min(lower.z, point.z);
						}
						else
						{
							lower = new THREE.Vector3(point.x, point.y, point.z);
						}
					}
				}
			}
			WebGLViewer.applicationModelRoot.offset = lower;
			if(WebGLViewer.DEBUG) console.log("Offset: ("+lower.x+", "+lower.y+", "+lower.z+")");
		}
	},
	
	updateScene: function(bbox)
	{
		var lower = bbox[0];
		var upper = bbox[1];
		if( ! lower)
			return;
		var dx = upper.x - lower.x;
		var dy = upper.y - lower.y;
		var max = Math.max(dx, dy);
		var gridFactor = 1;
		var originFactor = 1;
		var rotSphereFactor = 1;
		var panSpeedFactor = 1;
		var zoomSpeedFactor = 1;
		if(max < 0.05) // scene < 5cm
		{
			gridFactor = 1000;
			originFactor = 8;
			rotSphereFactor = 8;
			panSpeedFactor = 125;
			zoomSpeedFactor = 125;
		}
		else if(max < 0.5) // 5cm < scene < 50cm
		{
			gridFactor = 100;
			originFactor = 4;
			rotSphereFactor = 4;
			panSpeedFactor = 25;
			zoomSpeedFactor = 25;
		}
		else if(max < 5) // 50cm < scene < 5m
		{
			gridFactor = 10;
			originFactor = 2;
			rotSphereFactor = 2;
			panSpeedFactor = 5;
			zoomSpeedFactor = 5;
		}
		else if(max < 50) // 5m < scene < 50m
		{
			gridFactor = 1;
			originFactor = 1;
			rotSphereFactor = 1;
			panSpeedFactor = 1;
			zoomSpeedFactor = 1;
		}
		else if(max < 500) // 50m < scene < 500m
		{
			gridFactor = 0.1;
			originFactor = 0.5;
			rotSphereFactor = 0.5;
			panSpeedFactor = 0.2;
			zoomSpeedFactor = 0.2;
		}
		else // scene > 500m
		{
			gridFactor = 0.01;
			originFactor = 0.25;
			rotSphereFactor = 0.25;
			panSpeedFactor = 0.04;
			zoomSpeedFactor = 0.04;
		}
		//update grid
		var ext = dx > dy ? 0.1*dx  : 0.1*dy;
		var xStart = Math.round((lower.x - ext)*gridFactor)/gridFactor;
		var yStart = Math.round((lower.y - ext)*gridFactor)/gridFactor;
		var xEnd = Math.round((upper.x + ext)*gridFactor)/gridFactor;
		var yEnd = Math.round((upper.y + ext)*gridFactor)/gridFactor;
		var majorTick = 1 / gridFactor;
		var minorTick = 0.2 / gridFactor;
		if(WebGLViewer.DEBUG) console.log("Grid units: Major Ticks = "+majorTick+" Meter, Minor Ticks = "+minorTick+" Meter");
		WebGLViewer.grid.update(xStart, yStart, xEnd, yEnd, majorTick, minorTick);
		//update origin
		var l1 = 0.9 / originFactor;
		var l2 = 0.2 / originFactor;
		var r1 = 0.02 / originFactor;
		var r2 = 0.1 / originFactor;
		WebGLViewer.origin.update(l1, l2, r1, r2);
		//update rotation sphere
		var radius = 0.2 / rotSphereFactor;
		WebGLViewer.rotationSphere.update(radius);
		//update pan / zoom speed
		var rotateSpeed = 0.01;
		var zoomSpeed = 0.09 / zoomSpeedFactor;
		var panSpeed = 0.09 / panSpeedFactor;
		WebGLViewer.controls.setSensitivities(null, zoomSpeed, panSpeed);
	},
	
	/**
	 * Closes the specified model.
	 * @param {String} modelName - the name of the model to be closed (e.g. "myfile.ifc")
	 */
	closeFile: function(modelName)
	{
		console.log("Closing File: "+modelName);
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var node = nodes[i];
			if(node.file === modelName)
			{
				WebGLViewer.applicationModelRoot.removeNode(node);
				var scene = WebGLViewer.scene;
				scene.remove(node.mesh);
				var cadObjects = node.getCadObjects();
				for(var j = 0; j < cadObjects.length; j++)
				{
					var cadObject = cadObjects[j];
					if(cadObject.edges)
					{
						scene.remove(cadObject.edges);
					}
				}
				var bbox = WebGLViewer.cameraHelper.fitInScene();
				this.updateScene(bbox);
			}
		}
		WebGLViewer.render();
	},
	
	/**
	 * Closes all currently opened models.
	 */
	closeAllFiles: function()
	{
		console.log("Closing All Files");
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var node = nodes[i];
			WebGLViewer.applicationModelRoot.removeNode(node);
			var scene = WebGLViewer.scene;
			scene.remove(node.mesh);
		}
		WebGLViewer.render();
	},
	
	/**
	 * @private
	 */
	createMaterials: function()
	{
		var isWireframe = WebGLViewer.applicationController.isWireFramedViewEnabled;
		var materials = [
			//solid material (0)
			new THREE.MeshLambertMaterial({vertexColors: THREE.VertexColors, wireframe: isWireframe}),
			//transparent material (1)
			new THREE.MeshLambertMaterial({vertexColors: THREE.VertexColors, transparent : true, opacity: 0.7, wireframe: isWireframe}),
			//double sided solid material (2)
			new THREE.MeshLambertMaterial({vertexColors: THREE.VertexColors, side: THREE.DoubleSide, wireframe: isWireframe}),
			//double sided transparent material (3)
			new THREE.MeshLambertMaterial({vertexColors: THREE.VertexColors, transparent : true, opacity: 0.7, side: THREE.DoubleSide, wireframe: isWireframe})
		];
		return materials;
	},
	
	/**
	 * @private
	 */
	getMaterialIndex: function(isTransparent, isDoubleSided)
	{
		if(isTransparent)
		{
			if(isDoubleSided)
				return 3; //double sided transparent material
			else
				return 1; //transparent material
		}
		else
		{
			if(isDoubleSided)
				return 2; //double sided solid material
			else
				return 0; //solid material
		}
	},
};
/**
 * Creates an instance of ObjectPicker.
 * @constructor
 * @property {Number} xDown - the latest x coordinate of an mouse event relative to the canvas.
 * @property {Number} yDown - the latest y coordinate of an mouse event relative to the canvas.
 */
ObjectPicker = function()
{
	this.xDown = 0;
	this.yDown = 0;
	this.init();
};

ObjectPicker.prototype =
{
	/**
	 * Initializes the object Picker (adds mouse event listeners to canvas object).
	 * @private
	 */
	init: function()
	{
		var self = this;
		var mousedown = function(event)
		{
			if(WebGLViewer.mouseUtils.isLeftMouseButton(event) && ! event.ctrlKey && ! event.shiftKey)
			{
				var pos = self.getPositionRelativeToCanvas(event);
				self.xDown = pos[0];
				self.yDown = pos[1];
				self.setRotationCenter(pos[0], pos[1]);
			}
		};
		var mouseup = function(event)
		{
			if(WebGLViewer.mouseUtils.isLeftMouseButton(event) && ! event.ctrlKey && ! event.shiftKey)
			{
				var pos = self.getPositionRelativeToCanvas(event);
				var x = pos[0];
				var y = pos[1];
				var dx = self.xDown - x;
				var dy = self.yDown - y;
				var TOL = 5;
				if(Math.abs(dx) < TOL && Math.abs(dy) < TOL)
				{
					self.pickObject(x, y);
				}
				WebGLViewer.rotationSphere.setVisible(false);
			}
		};
		var mouseout = function(event)
		{
			WebGLViewer.rotationSphere.setVisible(false);
		};
		var touchstart = function(event)
		{
			//one finger touch
			if(event.touches.length === 1)
			{
				var pos = self.getPositionRelativeToCanvas(event);
				self.xDown = pos[0];
				self.yDown = pos[1];
				self.setRotationCenter(pos[0], pos[1]);
			}
		};
		var touchend = function(event)
		{
			//one finger touch
			if(event.changedTouches.length === 1)
			{
				var pos = self.getPositionRelativeToCanvas(event);
				var x = pos[0];
				var y = pos[1];
				var dx = self.xDown - x;
				var dy = self.yDown - y;
				var TOL = 5;
				if(Math.abs(dx) < TOL && Math.abs(dy) < TOL)
				{
					self.pickObject(x, y);
				}
				WebGLViewer.rotationSphere.setVisible(false);
			}
		};
		WebGLViewer.canvas.addEventListener("mousedown", mousedown, false);
		WebGLViewer.canvas.addEventListener("mouseup", mouseup, false);
		WebGLViewer.canvas.addEventListener("mouseout", mouseout, false);
		WebGLViewer.canvas.addEventListener("touchstart", touchstart, false);
		WebGLViewer.canvas.addEventListener("touchend", touchend, false);
	},
	
	/**
	 * Computes the intersection point with the geometry model
	 * and changes the rotation point center to the new point,
	 * if an intersection could be detected.
	 * Further, the rotation sphere will be set visible.
	 * @param {Number} x - the x coordinate on screen relative to the canvas.
	 * @param {Number} y - the y coordinate on screen relative to the canvas.
	 */
	setRotationCenter: function(x, y)
	{
		if(!WebGLViewer.rotationSphere.isEnabled)
			return;
		var intersects = this.getIntersections(x, y);
		if (intersects.length > 0) 
		{
			var point = intersects[0].point;
			WebGLViewer.controls.rotationPoint.set(point.x, point.y, point.z);
			WebGLViewer.rotationSphere.setPosition(point);
		}
		WebGLViewer.rotationSphere.setVisible(true);
	},
	
	/**
	 * Computes the intersections with the geometry model
	 * and selects the picked cad object,
	 * if an intersection could be detected.
	 * @param {Number} x - the x coordinate on screen relative to the canvas.
	 * @param {Number} y - the y coordinate on screen relative to the canvas.
	 */
	pickObject: function(x, y)
	{
		var intersects = this.getIntersections(x, y);
		for(var i = 0; i < intersects.length; i++)
		{
			var face = intersects[i].face;
			var index = intersects[i].faceIndex*3;
			var mesh = intersects[i].object;
			var cadObject = WebGLViewer.applicationModelRoot.getNodeByMesh(mesh).getCadObjectByVertexIndex(index);
			if(cadObject.isVisible)
			{
				WebGLViewer.applicationModelRoot.selectionModel.setObjectSelected(cadObject, ! cadObject.isSelected);
				break;
			}
		}
	},
	
	/**
	 * Computes the intersections with the geometry model.
	 * Checks all intersections between the ray and the objects. 
	 * Intersections are returned sorted by distance, closest first.
	 * @param {Number} x - the x coordinate on screen relative to the canvas.
	 * @param {Number} y - the y coordinate on screen relative to the canvas.
	 * @return {Object[]: distance, point, face, faceIndex, object} the intersection objects.
	 */
	getIntersections: function(x, y)
	{
		var camera = WebGLViewer.camera;
		var vector = new THREE.Vector3( (x/WebGLViewer.width)*2-1, -(y/WebGLViewer.height)*2+1, 0.5 );
		vector.unproject(camera);
		var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
		var meshes = [];
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for (var i = 0; i < nodes.length; i++)
		{
			meshes.push(nodes[i].mesh);
		}
		return raycaster.intersectObjects(meshes);
	},
	
	/**
	 * Computes the position relative to the canvas object of an mouse event.
	 * @param {Event} e - the mouse event.
	 * @return {Number[]} array containing the x and y coordinate [x,y].
	 */
	getPositionRelativeToCanvas: function(e) 
	{
        var myObject = e.target;
        var posx = 0, posy = 0;
        if(e.touches && e.touches.length === 1)
        {
        	posx = e.touches[0].pageX;
        	posy = e.touches[0].pageY;
        }
        else if(e.changedTouches && e.changedTouches.length === 1)
        {
        	posx = e.changedTouches[0].pageX;
        	posy = e.changedTouches[0].pageY;
        }
        else if (e.pageX && e.pageY) 
		{
            posx = e.pageX;
            posy = e.pageY;
        } 
		else if (e.clientX && e.clientY) 
		{
            posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
		}
        var divGlobalOffset = function(obj) {
            var x=0, y=0;
            x = obj.offsetLeft;
            y = obj.offsetTop;
            var body = document.getElementsByTagName('body')[0];
            while (obj.offsetParent && obj!=body)
			{
                x += obj.offsetParent.offsetLeft;
                y += obj.offsetParent.offsetTop;
                obj = obj.offsetParent;
            }
            return [x,y];
        };
        var globalOffset = divGlobalOffset(myObject);
		var x = posx - globalOffset[0];
		var y = posy - globalOffset[1];
        return [x,y];
    },
};
Origin = function()
{
	this.isVisible = true;
	this.xArrow = undefined;
	this.yArrow = undefined;
	this.zArrow = undefined;
};

Origin.prototype =
{
	addToScene: function(scene)
	{
		if(this.xArrow)
		{
			scene.add(this.xArrow);
			scene.add(this.yArrow);
			scene.add(this.zArrow);
		}
	},
	
	removeFromScene: function(scene)
	{
		if(this.xArrow)
		{
			scene.remove(this.xArrow);
			scene.remove(this.yArrow);
			scene.remove(this.zArrow);
		}
	},
	
	setVisible: function(isVisible)
	{
		if(isVisible === this.isVisible)
			return;
		if(isVisible)
			this.addToScene(WebGLViewer.scene);
		else
			this.removeFromScene(WebGLViewer.scene);
		this.isVisible = isVisible;
		WebGLViewer.render();
		WebGLViewer.menuBar.setButtonActive("origin", isVisible);
	},
	
	update: function(l1, l2, r1, r2)
	{
		this.removeFromScene(WebGLViewer.scene);
		//settings
		l1 = l1 ? l1 : 0.9;
		l2 = l2 ? l2 : 0.2;
		r1 = r1 ? r1 : 0.02;
		r2 = r2 ? r2 : 0.1;
		//xArrow
		var xCylinder = new THREE.CylinderGeometry(r1, r1, l1);
		xCylinder.applyMatrix(new THREE.Matrix4().makeTranslation(0, l1/2, 0));
		xCylinder.applyMatrix(new THREE.Matrix4().makeRotationZ(-Math.PI/2));
		var xCone = new THREE.CylinderGeometry(0, r2, l2);
		xCone.applyMatrix(new THREE.Matrix4().makeTranslation(0, l1+l2/2, 0));
		xCone.applyMatrix(new THREE.Matrix4().makeRotationZ(-Math.PI/2));
		xCylinder.merge(xCone);
		var material = new THREE.MeshBasicMaterial( {color: 0xff0000} );
		this.xArrow = new THREE.Mesh(xCylinder, material);
		//yArrow
		var yCylinder = new THREE.CylinderGeometry(r1, r1, l1);
		yCylinder.applyMatrix(new THREE.Matrix4().makeTranslation(0, l1/2, 0));
		var yCone = new THREE.CylinderGeometry(0, r2, l2);
		yCone.applyMatrix(new THREE.Matrix4().makeTranslation(0, l1+l2/2, 0));
		yCylinder.merge(yCone);
		var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
		this.yArrow = new THREE.Mesh(yCylinder, material);
		//zArrow
		var zCylinder = new THREE.CylinderGeometry(r1, r1, l1);
		zCylinder.applyMatrix(new THREE.Matrix4().makeTranslation(0, l1/2, 0));
		zCylinder.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI/2));
		var zCone = new THREE.CylinderGeometry(0, r2, l2);
		zCone.applyMatrix(new THREE.Matrix4().makeTranslation(0, l1+l2/2, 0));
		zCone.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI/2));
		zCylinder.merge(zCone);
		var material = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
		this.zArrow = new THREE.Mesh(zCylinder, material);
		if(this.isVisible)
			this.addToScene(WebGLViewer.scene);
		WebGLViewer.render();
	}
}
RotationSphere = function()
{
	this.mesh = undefined;
	this.isEnabled = true;
};

RotationSphere.prototype =
{
	addToScene: function(scene)
	{
		if(this.mesh)
		{
			scene.add(this.mesh);
		}
	},
	
	removeFromScene: function(scene)
	{
		if(this.mesh)
		{
			scene.remove(this.mesh);
		}
	},
	
	setEnabled: function(isEnabled)
	{
		this.isEnabled = isEnabled;
	},
	
	setVisible: function(isVisible)
	{
		if(!this.isEnabled)
			return;
		if(this.mesh)
			this.mesh.visible = isVisible;
		WebGLViewer.render();
	},
	
	setPosition: function(position)
	{
		if(!this.isEnabled)
			return;
		position = position ? position : new THREE.Vector3(0, 0, 0);
		this.mesh.position.set(position.x, position.y, position.z);
		WebGLViewer.render();
	},
	
	update: function(radius)
	{
		this.removeFromScene(WebGLViewer.scene);
		//settings
		var radius = radius ? radius : 0.2;
		this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius), new THREE.MeshNormalMaterial());
		var position = WebGLViewer.controls.rotationPoint;
		this.mesh.position.set(position.x, position.y, position.z);
		this.mesh.overdraw = true;
		this.mesh.visible = false;
		this.addToScene(WebGLViewer.scene);
		WebGLViewer.render();
	}
}
/**
 * Creates an instance of SelectionInfoView.
 * @constructor
 * @property {String} id - The ID of this view.
 * @property {Number} hideID - An temporary ID used for hiding the view after a specific time.
 */
SelectionInfoView = function()
{
	this.id = "selectioninfoview";
	this.hideID = undefined;
	this.init();
};

SelectionInfoView.prototype =
{
	/**
	 * Initializes the selection view (adds listener to selection model).
	 * @private
	 */
	init: function()
	{
		//add selection listener
		WebGLViewer.applicationModelRoot.selectionModel.addListener(this);
	},
	
	/**
	 * Invoked by selection model, if an selection event occurs.
	 * @param {CadObject[]} objects - the selected objects.
	 * @param {Boolean} isSelected - true, if objects are selected. false if objects are deselected.
	 */
	objectsSelected: function(objects, isSelected)
	{
		//update view only when objects were selected
		if(isSelected)
		{
			//update view
			this.update(objects);
			//set view visible
			this.setVisible(true);
			//create self reference for timeout function
			var self = this;
			//create hide ID. Needed to identify the last invoked timeout thread.
			//Only the last timeout thread is allowed to hide the view.
			//Otherwise it could happen, that view will get hidden, because an older thread hides the view,
			//although newer information should be displayed.
			var threadHideID = Math.random();
			//set hideID to same value than threadHideID
			this.hideID = threadHideID;
			//create timeout thread. Afterwards, view will get hidden.
			setTimeout(function(){
				//check, if threadHideID still equals hideID, or if it is overwritten by an later event
				if(threadHideID == self.hideID)
				{
					//hide view
					self.setVisible(false);
				}
			}, 3000); //timeout: 3000ms
		}
	},

	/**
	 * Changes the visibility of the view.
	 * @param {Boolean} isVisible - true, if view should be visible, otherwise false.
	 */
	setVisible: function(isVisible)
	{
		var div_view = WebGLViewer.menuBar.getElementById(this.id);
		if(div_view)
		{
			if(isVisible)
				div_view.style.display = 'block';
			else
				div_view.style.display = 'none';
		}
	},
	
	/**
	 * Returns, whether this view is visible or not.
	 * @return {Boolean} true, if view is visible.
	 */
	isVisible: function()
	{
		var div_view = WebGLViewer.menuBar.getElementById(this.id);
		if(div_view)
		{
			return div_view.style.display === 'block';
		}
		else
		{
			return false;
		}
	},
	
	/**
	 * Updates this view component and sets the inner HTML content of the view.
	 * Invoked by the internal selection listener.
	 * @param {Cadobject[]} selectedObjects - the objects that were selected.
	 */
	update: function(selectedObjects)
	{
		var div_view = WebGLViewer.menuBar.getElementById(this.id);
			if( ! div_view)
				return;
		var content;
		if(selectedObjects.length == 1)
		{
			var object = selectedObjects[0];
			content = "<b>"+object.type+"</b><br>"+
					  "Name: "+object.name+"<br>"+
					  "Step-Nr.: #"+object.stepnr+"<br>"+
					  "GUID: "+object.guid;
		}
		else
		{
			content = selectedObjects.length+" objects selected";
		}
		div_view.innerHTML = content;
	}
};
/**
 * Creates an instance of SelectionModel.
 * Model for selection handling to help holding registered views synchronous.
 * @constructor
 * @property {Object[]} listeners - List of listeners receiving selection events.
 * @property {Boolean} autoUpdateView - flag indicating, whether 3D view should be updated automatically after a selection event or not.
 * @property {Number} selectionColor - The color to be used for colorizing objects, when they will be selected (e.g. "0xffffff").
 */
SelectionModel = function()
{
	this.listeners = [];
	this.autoUpdateView = true;
	this.selectionColor = [0.2, 0.4, 0.6]; //0xff9900 
};

SelectionModel.prototype =
{
	/**
	 * Adds a selection listener to this model.
	 * The listener must implement the following method(s):
	 * - objectsSelected(CadObject[] selectedCadObjects, Boolean isSelected)
	 * The method(s) will be invoked by this model, when a corresponding event occurs.
	 * @param {Object} listener - the listener to be added.
	 */
	addListener: function(listener)
	{
		this.listeners[this.listeners.length] = listener;
	},
	
	/**
	 * Sets the selection color to the specified color.
	 * @param {Number} newColor - The color to be used for colorizing objects, when they will be selected (e.g. "0xffffff").
	 */
	setSelectionColor: function(newColor)
	{
		this.selectionColor = newColor;
		var selectedObjects = WebGLViewer.applicationModelRoot.selectionModel.getSelectedObjects();
		WebGLViewer.applicationModelRoot.selectionModel.clearSelection();
		WebGLViewer.applicationModelRoot.selectionModel.setObjectsSelected(selectedObjects, true);
	},

	/**
	 * Selects/Deselects the specified cad object.
	 * @param {CadObject} cadObject - the cad object to be set selected/deselected.
	 * @param {Boolean} isSelected - whether cad object should be selected or deselected.
	 */
	setObjectSelected: function(cadObject, isSelected)
	{
		cadObject.setSelected(isSelected);
		var objectNodes = [];
		objectNodes[0] = cadObject;
		this.fireObjectsSelected(objectNodes, isSelected);
		this.updateView();
	},
	
	/**
	 * Selects/Deselects the specified cad objects.
	 * @param {CadObject[]} cadObjects - the cad objects to be set selected/deselected.
	 * @param {Boolean} isSelected - whether cad objects should be selected or deselected.
	 */
	setObjectsSelected: function(cadObjects, isSelected)
	{
		for (var i = 0; i < cadObjects.length; i++)
		{
			cadObjects[i].setSelected(isSelected);
		}
		this.fireObjectsSelected(cadObjects, isSelected);
		this.updateView();
	},
	
	/**
	 * Clears the current selection.
	 */
	clearSelection: function()
	{
		this.setObjectsSelected(this.getSelectedObjects(), false);
	},
	
	/**
	 * Inverts the current selection (invisible objects included).
	 */
	invertSelection: function()
	{
		var selectedNodes = [];
		var deselectedNodes = [];
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for (var i = 0; i < nodes.length; i++)
		{
			var cadObjects = nodes[i].getCadObjects();
			for (var j = 0; j < cadObjects.length; j++)
			{
				if(cadObjects[j].isSelected)
					selectedNodes.push(cadObjects[j]);
				else
					deselectedNodes.push(cadObjects[j]);
			}
		}
		this.autoUpdateView = false;
		this.setObjectsSelected(selectedNodes, false);
		this.setObjectsSelected(deselectedNodes, true);
		this.autoUpdateView = true;
		this.updateView();
	},
	
	/**
	 * Returns a collection with the currently selected cad objects.
	 * @return {CadObject[]} the selected cad objects.
	 */
	getSelectedObjects: function()
	{
		var selectedObjects = [];
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var cadObjects = nodes[i].getCadObjects();
			for (var j = 0; j < cadObjects.length; j++)
			{
				if(cadObjects[j].isSelected)
					selectedObjects.push(cadObjects[j]);
			}
		}
		return selectedObjects;
	},
	
	/**
	 * Informs the scenegraph (3D view), that an selection event has been occurred.
	 */
	updateView: function()
	{
		if( ! this.autoUpdateView)
			return;
		WebGLViewer.applicationController.updateViewAfterColorChange();
	},
	
	/**
	 * Informs registered listeners that cad objects were selected/deselected.
	 * @param {CadObject[]} objects - the objects that were selected/deselected.
	 * @param {Boolean} isSelected - whether objects were selected or deselected.
	 * @private
	 */
	fireObjectsSelected: function(objects, isSelected)
	{
		for (var i = 0; i < this.listeners.length; i++)
		{
			this.listeners[i].objectsSelected(objects, isSelected);
		}
	}
};
/**
 * Creates an instance of Shape.
 * @constructor
 * @property {THREE.Face3[]} faces - The triangles of this shape.
 * @property {Number} color - The color of this shape (e.g. "0xffffff").
 */
Shape = function(geometry)
{
	this.faces = [];
	this.color = [0.0, 0.0, 0.0];
	this.color2 = undefined;
	this.isSelected = false;
	this.geometry = geometry;
	this.vertexStart = 0;
	this.vertexEnd = 0;
	this._position = undefined;
};

Shape.prototype =
{
	/**
	 * Sets this shape visible or invisible.
	 * @param {Boolean} isVisible - Whether shape should be set visible or invisible.
	 */
	setVisible: function(isVisible)
	{
		if(isVisible)
		{
			//show the vertices
			var index = 0;
			for(var i = this.vertexStart; i < this.vertexEnd; i+=3)
			{
				this.geometry.attributes.position.array[i] = this._position[index++];
				this.geometry.attributes.position.array[i+1] = this._position[index++];
				this.geometry.attributes.position.array[i+2] = this._position[index++];
			}
			this._position = undefined;
		}
		else
		{
			//hide the vertices
			var size = this.vertexEnd - this.vertexStart + 1;
			this._position = new Array(size);
			var index = 0;
			for(var i = this.vertexStart; i < this.vertexEnd; i+=3)
			{
				this._position[index++] = this.geometry.attributes.position.array[i];
				this._position[index++] = this.geometry.attributes.position.array[i+1];
				this._position[index++] = this.geometry.attributes.position.array[i+2];
				this.geometry.attributes.position.array[i] = 0.0;
				this.geometry.attributes.position.array[i+1] = 0.0;
				this.geometry.attributes.position.array[i+2] = 0.0;
			}
		}
	},
	
	/**
	 * Sets this shape selected or deselected.
	 * @param {Boolean} isSelected - Whether shape should be set selected or deselected.
	 */
	setSelected: function(isSelected)
	{
		var color = isSelected ? WebGLViewer.applicationModelRoot.selectionModel.selectionColor : this.color2 ? this.color2 : this.color;
		for(var i = this.vertexStart; i < this.vertexEnd; i+=3)
		{
			this.geometry.attributes.color.array[i] = color[0];
			this.geometry.attributes.color.array[i+1] = color[1];
			this.geometry.attributes.color.array[i+2] = color[2];
		}
		this.isSelected = isSelected;
	},
	
	/**
	 * Sets the color of this shape to the specified color.
	 * If the specified color is undefined, the color will be reset to the original color.
	 * After changing the color of one or more objects, call 
	 * WebGLViewer.applicationController.updateViewAfterColorChange();
	 * to update the scenegraph (3D view).
	 * @param {Number} color - The color to be set (e.g. "0xffffff").
	 */
	setColor: function(newColor)
	{
		if(newColor)
		{
			this.color2 = newColor;
			if( ! this.isSelected)
			{
				for(var i = this.vertexStart; i < this.vertexEnd; i+=3)
				{
					this.geometry.attributes.color.array[i] = newColor[0];
					this.geometry.attributes.color.array[i+1] = newColor[1];
					this.geometry.attributes.color.array[i+2] = newColor[2];
				}
			}
		}
		else
		{
			this.resetColor();
		}
	},
	
	/**
	 * Resets the color of this shape to the original color.
	 * After changing the color of one or more objects, call 
	 * WebGLViewer.applicationController.updateViewAfterColorChange();
	 * to update the scenegraph (3D view).
	 */
	resetColor: function()
	{
		this.color2 = undefined;
		if( ! this.isSelected)
		{
			for(var i = this.vertexStart; i < this.vertexEnd; i+=3)
			{
				this.geometry.attributes.color.array[i] = this.color[0];
				this.geometry.attributes.color.array[i+1] = this.color[1];
				this.geometry.attributes.color.array[i+2] = this.color[2];
			}
		}
	}
};
/**
 * Creates an instance of SimpleFileChooser.
 * @constructor
 * @property {String} id - The ID of this view.
 */
SimpleFileChooser = function()
{
	this.id = "filechooserview";
	this.init();
};

SimpleFileChooser.prototype =
{
	/**
	 * Initializes the view.
	 * @private
	 */
	init: function()
	{
		WebGLViewer.menuBar.addView(this);
	}
};
/**
 * Creates an instance of SpatialModel.
 * Model for providing the spatial structure of the models.
 * @constructor
 */
SpatialModel = function()
{
	this.listeners = [];
	this.modelSpatialNodeMap = {};
};

SpatialModel.prototype =
{
	/**
	 * Adds a spatial model listener to this model.
	 * The listener must implement the following method(s):
	 * - spatialRootNodeAdded(SpatialNode spatialRootNode)
	 * - spatialRootNodeRemoved(SpatialNode spatialRootNode)
	 * The method(s) will be invoked by this model, when a corresponding event occurs.
	 * @param {Object} listener - the listener to be added.
	 */
	addListener: function(listener)
	{
		this.listeners.push(listener);
	},
		
	/**
	 * Updates the spatial model, when a new ApplicationModelNode was added.
	 * Invoked by ApplicationModelRoot.
	 * @private
	 * @param {ApplicationModelNode} applicationModelNode - the applicationModelNode that was added.
	 */
	nodeAdded: function(applicationModelNode)
	{
		if(WebGLViewer.DEBUG)
		{
			console.log("START spatial model update...");
		}
		var time1 = new Date().getTime();
		var jsonSpatialModel = applicationModelNode._jsonSpatialModel;
		if(! jsonSpatialModel)
			return;
		var jsonRoot = jsonSpatialModel.Root;
		var guid = jsonRoot.GUID;
		var rootNode = new SpatialNode(guid);
		this.modelSpatialNodeMap[applicationModelNode.file] = rootNode;
		this.buildSpatialTree(applicationModelNode, rootNode, jsonRoot);
		if(WebGLViewer.DEBUG)
		{
			var time2 = new Date().getTime();
			console.log("END spatial model update. time="+(time2-time1)+"ms");
		}
		this.fireSpatialRootAdded(rootNode);
		if(WebGLViewer.DEBUG)
		{
			var time3 = new Date().getTime();
			console.log("spatial views updated. time="+(time3-time2)+"ms");
		}
	},
	
	/**
	 * Updates the spatial model, when an ApplicationModelNode has been removed.
	 * Invoked by ApplicationModelRoot.
	 * @private
	 * @param {ApplicationModelNode} applicationModelNode - the applicationModelNode that was removed.
	 */
	nodeRemoved: function(applicationModelNode)
	{
		var spatialRootNode = this.getSpatialRootNode(applicationModelNode);
		if(spatialRootNode)
		{
			this.modelSpatialNodeMap[applicationModelNode.file] = undefined;
			this.fireSpatialRootRemoved(spatialRootNode);
		}
	},
	
	/**
	 * Returns the spatial root node related to the specified applicationModelNode.
	 * @param applicationModelNode the applicationModelNode where the spatial root node is searched for.
	 * @returns the spatial root node
	 */
	getSpatialRootNode: function(applicationModelNode)
	{
		return this.modelSpatialNodeMap[applicationModelNode.file];
	},
	
	getCadObjectByGuid: function(guid)
	{
		var applicationModelNodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < applicationModelNodes.length; i++)
		{
			var applicationModelNode = applicationModelNodes[i];
			var cadObject = applicationModelNode.getCadObjectByGuid(guid);
			if(cadObject)
				return cadObject;
		}
		return undefined;
	},
	
	/**
	 * Builds up the spatial tree.
	 * @private
	 * @param {SpatialNode} parentNode - the parent node.
	 * @param {Object} jsonParent - the parent JSON node.
	 */
	buildSpatialTree: function(applicationModelNode, parentNode, jsonParent)
	{
		var cadObject = applicationModelNode.getCadObjectByGuid(jsonParent.GUID);
		if(!cadObject)
		{
			//create empty CadObjects for spatial entities with no explicit geometry
			cadObject = new CadObject(applicationModelNode);
			if(jsonParent.Name)
			{
				cadObject.name = jsonParent.Name;
			}
			cadObject.type = jsonParent.Type;
			cadObject.guid = jsonParent.GUID;
			cadObject.stepnr = jsonParent.STEPNr;
			applicationModelNode.addCadObject(cadObject);
		}
		if(jsonParent.Childs)
		{
			for(var i = 0; i < jsonParent.Childs.length; i++)
			{
				var jsonChild = jsonParent.Childs[i];
				var guid = jsonChild.GUID;
				var childNode = new SpatialNode(guid);
				parentNode.addChildNode(childNode);
				this.buildSpatialTree(applicationModelNode, childNode, jsonChild);
			}
		}
	},
	
	/**
	 * Informs registered listeners that visibility of cad objects were changed.
	 * @param {CadObject[]} objects - the objects that has been changed.
	 * @param {Boolean} isVisible - whether objects were set visible or invisible.
	 * @private
	 */
	fireSpatialRootAdded: function(spatialRootNode)
	{
		for (var i = 0; i < this.listeners.length; i++)
		{
			this.listeners[i].spatialRootNodeAdded(spatialRootNode);
		}
	},
	
	/**
	 * Informs registered listeners that visibility of cad objects were changed.
	 * @param {CadObject[]} objects - the objects that has been changed.
	 * @param {Boolean} isVisible - whether objects were set visible or invisible.
	 * @private
	 */
	fireSpatialRootRemoved: function(spatialRootNode)
	{
		for (var i = 0; i < this.listeners.length; i++)
		{
			this.listeners[i].spatialRootNodeRemoved(spatialRootNode);
		}
	}
};
/**
 * Creates an instance of SpatialNode.
 * A SpatialNode represents a spatial element within the spatial structure.
 * Each SpatialNode may have one or more child nodes.
 * @constructor
 */
SpatialNode = function(guid)
{
	this.parent = undefined;
	this.childs = new Array();
	this.guid = guid;
};

SpatialNode.prototype =
{
	/**
	 * Adds a child node to this node.
	 * @param {SpatialNode} child - the child node to be added.
	 */
	addChildNode: function(child)
	{
		this.childs.push(child);
		child.parent = this;
	},
	
	/**
	 * Removes a child node from this node.
	 * @param {SpatialNode} child - the child node to be removed.
	 */
	removeChildNode: function(child)
	{
		var index = this.childs.indexOf(child);
		if(index > -1)
		{
			this.childs.splice(index, 1);
			child.parent = undefined;
		}
	}
};
/**
 * Creates an instance of SpatialView.
 * @constructor
 * @property {String} id - The ID of this view.
 */
SpatialView = function()
{
	this.id = "spatialview";
	this.guidToTreeNodeMap = new Array();
	this.modelViewMap = {};
	this.init();
};

SpatialView.prototype =
{
	/**
	 * Initializes the tree view (adds listeners to selection model and visibility model).
	 * @private
	 */
	init: function()
	{
		//add selection listener
		WebGLViewer.applicationModelRoot.selectionModel.addListener(this);
		//add visibility listener
		WebGLViewer.applicationModelRoot.visibilityModel.addListener(this);
		//add model node listener
		WebGLViewer.applicationModelRoot.spatialModel.addListener(this);
		WebGLViewer.menuBar.addView(this);
		this.update();
	},
	
	/**
	 * Invoked by selection model, if an selection event occurs.
	 * @param {CadObject[]} cadObjects - the selected objects.
	 * @param {Boolean} isSelected - true, if objects are selected. false if objects are deselected.
	 * @private
	 */
	objectsSelected: function(cadObjects, isSelected)
	{
		for(var i = 0; i < cadObjects.length; i++)
		{
			var treeNode = this.guidToTreeNodeMap[cadObjects[i].guid];
			if(treeNode)
			{
				treeNode.setSelected(isSelected, false, false);
			}
		}
	},
	
	/**
	 * Invoked by visibility model, if an visibility event occurs.
	 * @param {CadObject[]} cadObjects - the objects that visibility changes.
	 * @param {Boolean} isVisible - true, if objects are visible. false if objects are invisible.
	 */
	objectsVisibilityChange: function(cadObjects, isVisible)
	{
		for(var i = 0; i < cadObjects.length; i++)
		{
			var treeNode = this.guidToTreeNodeMap[cadObjects[i].guid];
			if(treeNode)
			{
				treeNode.setVisible(isVisible, false, false);
			}
		}
	},
	
	/**
	 * Invoked by spatial model, if a spatial root node was added.
	 * @param {SpatialNode} spatialRootNode - the spatial root node.
	 */
	spatialRootNodeAdded: function(spatialRootNode)
	{
		var spatialModel = WebGLViewer.applicationModelRoot.spatialModel;
		var guid = spatialRootNode.guid;
		var cadObject = spatialModel.getCadObjectByGuid(guid);
		var title = this.getTitle(cadObject);
		var isExpanded = this.shouldBeExpanded(cadObject);
		var rootTreeNode = new CheckBoxTreeNode(title, isExpanded);
		this.guidToTreeNodeMap[guid] = rootTreeNode;
		rootTreeNode.userObject = cadObject.guid;
		new SpatialViewCallback(rootTreeNode, spatialRootNode, this).initCallbacks();
		this.createChildNodes(spatialModel, spatialRootNode, rootTreeNode);
		var checkBoxTree = new CheckBoxTree(spatialRootNode.guid, rootTreeNode, true, true, false);
		this.updateAdd(spatialRootNode, checkBoxTree);
	},
	
	createChildNodes: function(spatialModel, parent, parentTreeNode)
	{
		for(var i = 0; i < parent.childs.length; i++)
		{
			var child = parent.childs[i];
			var cadObject = spatialModel.getCadObjectByGuid(child.guid);
			var title = this.getTitle(cadObject);
			var isExpanded = this.shouldBeExpanded(cadObject);
			var childTreeNode = new CheckBoxTreeNode(title, isExpanded);
			this.guidToTreeNodeMap[child.guid] = childTreeNode;
			childTreeNode.userObject = cadObject.guid;
			new SpatialViewCallback(childTreeNode, child, this).initCallbacks();
			parentTreeNode.addChild(childTreeNode);
			if(isExpanded)
			{
				this.createChildNodes(spatialModel, child, childTreeNode);
			}
			else if(child.childs.length > 0)
			{
				var title = "_PSEUDO_TREE_NODE_";
				var pseudoTreeNode = new CheckBoxTreeNode(title, false);
				childTreeNode.addChild(pseudoTreeNode);
			}
		}
	},
	
	/**
	 * Returns whether this node should be expanded at startup based on the specified type.
	 * @param {String} type - the type of this IFC object's node (e.g. "IfcWall").
	 */
	shouldBeExpanded: function(cadObject)
	{
		if(cadObject)
		{
			var type = cadObject.type;
			return  type === "IfcProject" || 
					type === "IfcSite" || 
					type === "IfcBuilding";
		}
		return true;
	},
	
	/**
	 * Invoked by spatial model, if a spatial root node was removed.
	 * @param {SpatialNode} spatialRootNode - the spatial root node.
	 */
	spatialRootNodeRemoved: function(spatialRootNode)
	{
		this.updateRemove(spatialRootNode);
	},
	
	/**
	 * Returns the title for a cad object (either cadObject's name, if specified, or cadObject's type and STEP Nr).
	 * @param {CadObject} cadObject - the spatial cad object.
	 * @return {String} the title.
	 */
	getTitle: function(cadObject)
	{
		if(cadObject.name)
		{
			return cadObject.name;
		}
		else
		{
			return cadObject.type+" (#"+cadObject.stepnr+")";
		}
	},
	
	/**
	 * Updates the view.
	 */
	update: function()
	{
		var div_view = WebGLViewer.menuBar.getElementById(this.id);
		if( ! div_view)
			return;
		var titleBar = " ";
		div_view.innerHTML = titleBar;
	},
	
	updateAdd: function(spatialRootNode, checkBoxTree)
	{
		var div_view = WebGLViewer.menuBar.getElementById(this.id);
		if( ! div_view)
			return;
		var modelDiv = document.createElement("div");
		modelDiv.innerHTML = checkBoxTree.toHTML();
		div_view.appendChild(modelDiv);
		checkBoxTree.initCallbacks();
		this.modelViewMap[spatialRootNode.guid] = modelDiv;
	},
	
	updateRemove: function(spatialRootNode)
	{
		var div_view = WebGLViewer.menuBar.getElementById(this.id);
		if( ! div_view)
			return;
		var cadObject = WebGLViewer.applicationModelRoot.spatialModel.getCadObjectByGuid(spatialRootNode.guid);
		var modelDiv = this.modelViewMap[spatialRootNode.guid];
		div_view.removeChild(modelDiv);
	}
};

/**
 * Creates an instance of SpatialViewCallback.
 * Specifies, how a selection or visibility event triggered by a tree node is handled.
 * @constructor
 * @property {SpatialNode} spatialNode - the node that triggers.
 */
function SpatialViewCallback(node, spatialNode, spatialView)
{
	this.node = node;
	this.spatialNode = spatialNode;
	this.spatialView = spatialView;
}

SpatialViewCallback.prototype =
{
	/**
	 * Initializes the callbacks.
	 */
	initCallbacks: function()
	{
		this.setExpansionCallback();
		this.setVisibilityCallback();
		this.setSelectionCallback();
	},
	
	/**
	 * Initializes the visibility callback.
	 */
	setExpansionCallback: function()
	{
		var self = this;
		this.node.expansionCallback = function(isExpanded) {
			if(isExpanded && self.node.getChildCount() == 1 && self.node.childs[0].title === "_PSEUDO_TREE_NODE_")
			{
				self.node.removeChild(self.node.childs[0]);
				var spatialModel = WebGLViewer.applicationModelRoot.spatialModel;
				var node = self.spatialNode;
				var treeNode = self.node;
				self.spatialView.createChildNodes(spatialModel, node, treeNode);
				self.node.update();
			}
		};
	},
	
	/**
	 * Initializes the visibility callback.
	 */
	setVisibilityCallback: function()
	{
		var self = this;
		this.node.checkBoxCallback = function(isChecked) {
			var objectNodes = new Array();
			self.addObjectNodes(self.spatialNode, objectNodes);
			if(objectNodes.length > 0)
			{
				WebGLViewer.applicationModelRoot.visibilityModel.setObjectsVisible(objectNodes, isChecked);
			}
		};
	},
	
	/**
	 * Initializes the selection callback.
	 */
	setSelectionCallback: function()
	{
		var self = this;
		this.node.selectionCallback = function(isSelected) {
			var objectNodes = new Array();
			self.addObjectNodes(self.spatialNode, objectNodes);
			if(objectNodes.length > 0)
			{
				WebGLViewer.applicationModelRoot.selectionModel.setObjectsSelected(objectNodes, isSelected);
			}
		};
	},	
	
	/**
	 * Collects the corresponding cad objects for a specified node including all child nodes.
	 * @private
	 * @param {SpatialNode} spatialNode - the node to be investigated.
	 * @param {CadObject[]} cadObjects - an array where all cad objects will be stored into.
	 */
	addObjectNodes: function(spatialNode, cadObjects)
	{
		var spatialModel = WebGLViewer.applicationModelRoot.spatialModel;
		var cadObject = spatialModel.getCadObjectByGuid(spatialNode.guid);
		if(cadObject)
		{
			cadObjects.push(cadObject);
		}
		for (var i = 0; i < spatialNode.childs.length; i++)
		{
			var child = spatialNode.childs[i];
			this.addObjectNodes(child, cadObjects);
		}
	}
}
/**
 * Creates an instance of StatusBar.
 * @constructor
 * @property {String} id - The ID of this view.
 */
StatusBar = function()
{
	this.id = "statusbar";
	this.init();
};

StatusBar.prototype =
{
	/**
	 * Initializes this view (adds listeners).
	 * @private
	 */
	init: function()
	{
		WebGLViewer.applicationModelRoot.addListener(this);
		this.update();
	},
	
	/**
	 * Invoked by ApplicationModelRoot, if model node was added.
	 * @param {ApplicationModelNode} node - the node that was added.
	 */
	nodeAdded: function(node)
	{
		var time1 = new Date().getTime();
		this.update();
		var time2 = new Date().getTime();
		if(WebGLViewer.DEBUG) console.log("Status Bar update: "+(time2-time1)+"ms");
	},
	
	/**
	 * Invoked by ApplicationModelRoot, if model node was removed.
	 * @param {ApplicationModelNode} node - the node that was removed.
	 */
	nodeRemoved: function(node)
	{
		this.update();
	},
	
	setText: function(text)
	{
		var statusBar = WebGLViewer.menuBar.getElementById(this.id);
		if( ! statusBar)
			return;
		statusBar.innerHTML = text;
	},
	
	/**
	 * Updates the status bar with information regarded to this model.
	 */
	update: function()
	{
		var statusBar = WebGLViewer.menuBar.getElementById(this.id);
		if( ! statusBar)
			return;
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		var triangleCount = 0;
		var cadObjectCount = 0;
//		var fileNames = "";
		for(var i = 0; i < nodes.length; i++)
		{
			var node = nodes[i];
			triangleCount += node.mesh.geometry.attributes.position.array.length / 9;
			cadObjectCount += node.getCadObjectCount();
//			fileNames += i>0 ? ", " : "";
//			fileNames += node.file;
		}
		var content;
//		if(nodes.length === 0)
//		{
//			content = "No IFC Files loaded.";
//		}
//		else
//		{
//			content = "IFC-Objects: "+cadObjectCount+" / Triangles: "+triangleCount+" / Files: "+fileNames;
			content = "Files: "+nodes.length+" | IFC Entities: "+cadObjectCount+" | Triangles: "+triangleCount;
//		}
		statusBar.innerHTML = content;
	}
};
/**
 * Creates an instance of TypesView.
 * @constructor
 * @property {String} id - The ID of this view.
 * @property {Map(String,CheckBoxTreeNode)} guidToTreeNodeMap - Maps the GUID of an IFC entity to its tree node in the types view.
 */
TypesView = function()
{
	this.id = "typesview";
	this.guidToTreeNodeMap = new Array();
	this.init();
};

TypesView.prototype =
{
	/**
	 * Initializes the types view (adds listeners to selection model and visibility model).
	 * @private
	 */
	init: function()
	{
		//add selection listener
		WebGLViewer.applicationModelRoot.selectionModel.addListener(this);
		//add visibility listener
		WebGLViewer.applicationModelRoot.visibilityModel.addListener(this);
		//add model node listener
		WebGLViewer.applicationModelRoot.addListener(this);
		WebGLViewer.menuBar.addView(this);
		this.update();
	},
	
	/**
	 * Invoked by ApplicationModelRoot, if model node was added.
	 * @param {ApplicationModelNode} node - the node that was added.
	 */
	nodeAdded: function(node)
	{
		var time1 = new Date().getTime();
		this.update();
		var time2 = new Date().getTime();
		if(WebGLViewer.DEBUG) console.log("Types View update: "+(time2-time1)+"ms");
	},
	
	/**
	 * Invoked by ApplicationModelRoot, if model node was removed.
	 * @param {ApplicationModelNode} node - the node that was removed.
	 */
	nodeRemoved: function(node)
	{
		this.update();
	},
	
	/**
	 * Invoked by selection model, if an selection event occurs.
	 * @param {CadObject[]} cadObjects - the selected objects.
	 * @param {Boolean} isSelected - true, if objects are selected. false if objects are deselected.
	 * @private
	 */
	objectsSelected: function(cadObjects, isSelected)
	{
		for(var i = 0; i < cadObjects.length; i++)
		{
			var treeNode = this.guidToTreeNodeMap[cadObjects[i].guid];
			if(treeNode)
			{
				treeNode.setSelected(isSelected);
			}
		}
	},
	
	/**
	 * Invoked by visibilty model, if an visibility event occurs.
	 * @param {CadObject[]} cadObjects - the objects that visibility changes.
	 * @param {Boolean} isVisible - true, if objects are visible. false if objects are invisible.
	 */
	objectsVisibilityChange: function(cadObjects, isVisible)
	{
		for(var i = 0; i < cadObjects.length; i++)
		{
			var treeNode = this.guidToTreeNodeMap[cadObjects[i].guid];
			if(treeNode)
			{
				treeNode.setVisible(isVisible);
			}
		}
	},
	
	/**
	 * Updates the view.
	 */
	update: function()
	{
		var div_view = WebGLViewer.menuBar.getElementById(this.id);
		if( ! div_view)
			return;
		
		var time1 = new Date().getTime();
		
		var root = new CheckBoxTreeNode("root", true);
		var tree = new CheckBoxTree("typetree", root, false, true, true);
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		var typeMap = {};
		for(var i = 0; i < nodes.length; i++)
		{
			var applicationModel = nodes[i];
			var types = applicationModel.getTypes();
			for(var j = 0; j < types.length; j++)
			{
				typeMap[types[j]] = true;
			}
		}
		
		var time2 = new Date().getTime();
		
		var types = Object.keys(typeMap).sort();
		
		var time3 = new Date().getTime();
		
		for(var i = 0; i < types.length; i++)
		{
			var type = types[i];
			var typeTreeNode = new CheckBoxTreeNode(type);
			root.addChild(typeTreeNode);
			new TypesViewCallback(typeTreeNode, type).initIfcTypeCallbacks();
			for(var j = 0; j < nodes.length; j++)
			{
				var applicationModel = nodes[j];
				var objectNodes = applicationModel.getCadObjectsOfType(type);
				for(var k = 0; k < objectNodes.length; k++)
				{
					var objectNode = objectNodes[k];
					var objectTreeNode = new CheckBoxTreeNode(this.getTitle(objectNode), false);
					this.guidToTreeNodeMap[objectNode.guid] = objectTreeNode;
					typeTreeNode.addChild(objectTreeNode);
					new TypesViewCallback(objectTreeNode, objectNode).initIfcObjectCallbacks();
				}
			}
		}
		
		var time4 = new Date().getTime();
		
		var titleBar = " ";
		
		div_view.innerHTML = titleBar + tree.toHTML();
		
		var time5 = new Date().getTime();
		
		tree.initCallbacks();
		
		var time6 = new Date().getTime();
		
		if(WebGLViewer.DEBUG)
		{
			console.log("Types View: build type map: "+(time2-time1)+"ms");
			console.log("Types View: sort type map: "+(time3-time2)+"ms");
			console.log("Types View: create object nodes: "+(time4-time3)+"ms");
			console.log("Types View: create HTML string: "+(time5-time4)+"ms");
			console.log("Types View: init callbacks: "+(time6-time5)+"ms");
		}
	},
	
	/**
	 * Returns the title for a cad object (either cadObject's name, if specified, or cadObject's type and STEP Nr).
	 * @param {CadObject} cadObject - the cad object.
	 * @return {String} the title.
	 */
	getTitle: function(cadObject)
	{
		if(cadObject.name)
		{
			return cadObject.name;
		}
		else
		{
			return cadObject.type+" (#"+cadObject.stepnr+")";
		}
	}
};

/**
 * Creates an instance of TypesViewCallback.
 * Specifies, how a selection or visibility event triggered by a tree node is handled.
 * @constructor
 * @property {CheckBoxTreeNode} node - the node that triggers.
 * @property {Object} userObject - either type {String} or cad object {CadObject}.
 */
function TypesViewCallback(node, userObject)
{
	this.node = node;
	this.userObject = userObject;
}

TypesViewCallback.prototype =
{
	/**
	 * Initializes the callbacks for a specific type. User object is then the type {String}.
	 */
	initIfcTypeCallbacks: function()
	{
		this.setIfcTypeVisibilityCallback();
		this.setIfcTypeSelectionCallback();
	},
	
	/**
	 * Initializes the callbacks for a specific cad object. User object is then the cad object {CadObject}.
	 */
	initIfcObjectCallbacks: function()
	{
		this.setIfcObjectVisibilityCallback();
		this.setIfcObjectSelectionCallback();
	},

	/**
	 * Initializes the visibility callback for a type.
	 */
	setIfcTypeVisibilityCallback: function()
	{
		var self = this;
		this.node.checkBoxCallback = function(isChecked) {
			WebGLViewer.applicationController.setTypeVisible(self.userObject, isChecked);
		};
	},
	
	/**
	 * Initializes the visibility callback for a cad object.
	 */
	setIfcObjectVisibilityCallback: function()
	{
		var self = this;
		this.node.checkBoxCallback = function(isChecked) {
			WebGLViewer.applicationModelRoot.visibilityModel.setObjectVisible(self.userObject, isChecked);
		};	
	},
	
	/**
	 * Initializes the selection callback for a type.
	 */
	setIfcTypeSelectionCallback: function()
	{
		var self = this;
		this.node.selectionCallback = function(isSelected) {
			WebGLViewer.applicationController.setTypeSelected(self.userObject, isSelected);
		};
	},
	
	/**
	 * Initializes the selection callback for a cad object.
	 */
	setIfcObjectSelectionCallback: function()
	{
		var self = this;
		this.node.selectionCallback = function(isSelected) {
			WebGLViewer.applicationModelRoot.selectionModel.setObjectSelected(self.userObject, isSelected);
		};
	}
};
/**
 * Creates an instance of VisibilityModel.
 * Model for visibility handling to help holding registered views synchronous.
 * @constructor
 * @property {Object[]} listeners - List of listeners receiving visibility events.
 * @property {Boolean} isDirty - flag indicating, that visibility of one or more objects has been changed.
 * @property {Boolean} autoUpdateView - flag indicating, whether 3D view should be updated automatically after a visibility event or not.
 */
VisibilityModel = function()
{
	this.listeners = [];
	this.isDirty = false;
	this.autoUpdateView = true;
};

VisibilityModel.prototype =
{
	/**
	 * Adds a visibility listener to this model.
	 * The listener must implement the following method(s):
	 * - objectsVisibilityChange(CadObject[] selectedCadObjects, Boolean isVisible)
	 * The method(s) will be invoked by this model, when a corresponding event occurs.
	 * @param {Object} listener - the listener to be added.
	 */
	addListener: function(listener)
	{
		this.listeners[this.listeners.length] = listener;
	},
	
	/**
	 * Sets the cad object with the specified GUID visible or invisible.
	 * @param {String} guid - the GUID.
	 * @param {Boolean} isVisible - whether cad object should be set visible or invisible.
	 */
	setObjectVisibleByGuid: function(guid, isVisible)
	{
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			var applicationModel = nodes[i];
			var cadObject = applicationModel.getCadObjectByGuid(guid);
			if(cadObject != undefined)
			{
				this.setObjectVisible(cadObject, isVisible);
			}
		}
	},

	/**
	 * Sets the specified cad object visible or invisible.
	 * @param {CadObject} cadObject - the cad object.
	 * @param {Boolean} isVisible - whether cad object should be set visible or invisible.
	 */
	setObjectVisible: function(cadObject, isVisible)
	{
		if(cadObject.isVisible === isVisible)
			return;
		this.isDirty = true;
		cadObject.setVisible(isVisible);
		var cadObjects = [];
		cadObjects[0] = cadObject;
		this.fireObjectsVisibilityChange(cadObjects, isVisible);
		this.updateView();
	},
	
	/**
	 * Sets the specified cad objects visible or invisible.
	 * @param {CadObject[]} cadObjects - the cad objects.
	 * @param {Boolean} isVisible - whether cad objects should be set visible or invisible.
	 */
	setObjectsVisible: function(cadObjects, isVisible)
	{
		for (var i = 0; i < cadObjects.length; i++)
		{
			if(cadObjects[i].isVisible != isVisible)
			{
				this.isDirty = true;
				cadObjects[i].setVisible(isVisible);
			}
		}
		if(this.isDirty)
		{
			this.fireObjectsVisibilityChange(cadObjects, isVisible);
			this.updateView();
		}
	},
	
	/**
	 * Returns all visible cad objects.
	 * @return all visible cad objects.
	 */
	getVisibleObjects: function()
	{
		var visibleCadObjects = [];
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for (var i = 0; i < nodes.length; i++)
		{
			var cadObjects = nodes[i].getCadObjects();
			for (var j = 0; j < cadObjects.length; j++)
			{
				if(cadObjects[j].isVisible)
					visibleCadObjects.push(cadObjects[j]);
			}
		}
		return visibleCadObjects;
	},
	
	/**
	 * Returns all invisible cad objects
	 * @return all invisible cad objects.
	 */
	getInvisibleObjects: function()
	{
		var invisibleCadObjects = [];
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for (var i = 0; i < nodes.length; i++)
		{
			var cadObjects = nodes[i].getCadObjects();
			for (var j = 0; j < cadObjects.length; j++)
			{
				if( ! cadObjects[j].isVisible)
					invisibleCadObjects.push(cadObjects[j]);
			}
		}
		return invisibleCadObjects;
	},
	
	/**
	 * Informs the scenegraph (3D view), that an visibility event has been occurred.
	 */
	updateView: function()
	{
		if( ! this.autoUpdateView)
			return;
		if( ! this.isDirty)
			return;
		var nodes = WebGLViewer.applicationModelRoot.getNodes();
		for(var i = 0; i < nodes.length; i++)
		{
			nodes[i].mesh.geometry.attributes.position.needsUpdate = true;
		}
		this.isDirty = false;
		WebGLViewer.render();
	},
	
	/**
	 * Informs registered listeners that visibility of cad objects were changed.
	 * @param {CadObject[]} objects - the objects that has been changed.
	 * @param {Boolean} isVisible - whether objects were set visible or invisible.
	 * @private
	 */
	fireObjectsVisibilityChange: function(objects, isVisible)
	{
		for (var i = 0; i < this.listeners.length; i++)
		{
			this.listeners[i].objectsVisibilityChange(objects, isVisible);
		}
	}
};
WebGLUtils = function()
{

}

WebGLUtils.prototype =
{
	/**
	 * Converts a decimal number in the range [0..255] into a hex string [00..ff].
	 * @param {Number} c - the number to be converted.
	 * @return {String} the hex value.
	 */
	componentToHex: function(c) 
	{
		var hex = c.toString(16);
		return hex.length == 1 ? "0" + hex : hex;
	},

	/**
	 * Creates a hex string from the specified RGB values.
	 * @param {Number} r - the red value [0.0 ... 1.0].
	 * @param {Number} g - the green value [0.0 ... 1.0].
	 * @param {Number} b - the blue value [0.0 ... 1.0].
	 * @return {Number} the hex value, e.g. "0xffffff"
	 */
	rgbToHex: function(r, g, b) 
	{
		//convert from double[0.0 .. 1.0] to int [0 .. 255]
		r = Math.round(r*255);
		g = Math.round(g*255);
		b = Math.round(b*255);
		//compute hex value and convert from String to double (*1.0)
		return ("0x" + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b))*1.0;
	}
}
/**
 * Creates an instance of WebGLViewer.
 * @constructor
 * @property {Number} width - The width of the viewer in Pixel. Do not modify this property! Instead, change the size of the canvas with method setSize(width, height)!
 * @property {Number} height - The height of the viewer in Pixel. Do not modify this property! Instead, change the size of the canvas with method setSize(width, height)!
 * @property {Canvas} canvas - The HTML canvas element for the 3D view.
 * @property {THREE.PerspectiveCamera} camera - the camera for the view.
 * @property {CameraControls} controls - the camera controller that processes mouse and touch events on the 3D view.
 * @property {CameraHelper} cameraHelper - camera utility functions.
 * @property {THREE.Scene} scene - the scene to be rendered.
 * @property {ObjectLoader} objectLoader - the object loader that can load and close models.
 * @property {THREE.WebGLRenderer} renderer - the renderer object that renders the scene.
 * @property {ObjectPicker} objectPicker - the object picker instance that processes click events on 3D view.
 * @property {MouseUtils} mouseUtils - mouse utility functions.
 * @property {MenuBar} menuBar - the menu bar object.
 * @property {ApplicationController} applicationController - the application controller that provides several service methods for controlling the viewer.
 * @property {ApplicationModelRoot} applicationModelRoot - the application model root that holds all the needed information about the loaded engineering models.
 * @property {Method} renderMethod - a reference to the internal render method.
 * @property {Origin} origin - the origin object.
 * @property {Grid} grid - the grid object.
 * @property {RotationSphere} rotationSphere - the rotation sphere object.
 * @property {WebglUtils} webglUtils - general utility functions.
 * @property {TypesView} typesView - the types view.
 * @property {TreeView} treeView - the tree view.
 * @property {AboutView} aboutView - the about view.
 * @property {StatusBar} statusBar - the status bar.
 * @property {SelectionInfoView} selectionInfoView - the selection info view.
 * @property {SimpleFileChooser} simpleFileChooser - the file view.
 * @property {LoadingInfoView} loadingInfoView - the loading info view.
 */
WebGLViewer = function()
{
	this.DEBUG = false;
	//canvas size
	this.width = 960;
	this.height = 540;
	//util
	this.canvas = undefined;
	this.camera = undefined;
	this.controls = undefined;
	this.controlsWalkMode = undefined;
	this.cameraHelper = undefined;
	this.cameraAnimation = undefined;
	this.scene = undefined;
	this.objectLoader = undefined;
	this.renderer = undefined;
	this.objectPicker = undefined;
	this.mouseUtils = new MouseUtils();
	this.menuBar = new MenuBar();
	this.applicationController = new ApplicationController();
	this.applicationModelRoot = new ApplicationModelRoot();
	this.renderMethod = undefined;
	this.origin = undefined;
	this.grid = undefined;
	this.rotationSphere = undefined;
	this.webglUtils = new WebGLUtils();
	//views
	this.typesView = undefined;
	this.spatialView = undefined;
	this.statusBar = undefined;
	this.selectionInfoView = undefined;
	this.simpleFileChooser = undefined;
	this.loadingInfoView = undefined;
};

WebGLViewer.prototype =
{
	/**
	 * Initializes the Web GL Viewer.
	 */
	initialize: function()
	{
		//init view and camera
		this.camera = new THREE.PerspectiveCamera(45, this.width/this.height, 0.01, 100000);
		this.camera.up.set(0,0,1);
		this.camera.position.set(-5,-6,5);
		this.camera.lookAt(new THREE.Vector3(0,0,0));
		this.renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
		this.renderer.setSize(this.width, this.height);
		this.canvas = this.renderer.domElement;
		//add canvas to 3D-View's div container
		document.getElementById("3dviewdiv").appendChild(this.canvas);
		//init object loader and create 3D scene
		this.objectLoader = new ObjectLoader();
		//create view components
		this.typesView = new TypesView();
		this.spatialView = new SpatialView();
		this.statusBar = new StatusBar();
		this.selectionInfoView = new SelectionInfoView();
		this.simpleFileChooser = new SimpleFileChooser();
		this.loadingInfoView = new LoadingInfoView();
		//delete json file model
		delete jsonFileModel;
		//init utils
		this.objectPicker = new ObjectPicker();
		this.controls = new CameraControls();
		this.controls.setEnabled(true);
		this.controlsWalkMode = new CameraControlsWalkMode();
		this.cameraHelper = new CameraHelper();
		this.cameraAnimation = new CameraAnimation();
		this.cameraHelper.fitInScene(false);
		var self = this;
		var clock = new THREE.Clock();
		var animate = function()
		{
			self.controls.update();
			self.controlsWalkMode.update();
			requestAnimationFrame(animate);
		}
		var render = function() 
		{
			self.renderer.render(self.scene, self.camera);
		};
		this.renderMethod = render;
		this.createScene();
		animate();
		render();
	},

	/**
	 * Creates the scene with default lighting, the origin, the grid and the rotation sphere.
	 * @return {THREE.Scene} the created scene.
	 */
	createScene: function()
	{
		this.scene = new THREE.Scene();
		//lighting
		if(typeof WebGLViewerLighting === 'undefined' || WebGLViewerLighting === null)
		{
			//ambient light
			var ambLight = new THREE.AmbientLight(0xbbbbbb);
			this.scene.add(ambLight);
			//directional light
			var dirLight1 = new THREE.DirectionalLight(0xaaaaaa, 1.0);
			dirLight1.position.set(-1,-2,3);
			this.scene.add(dirLight1);
			//directional light
			var dirLight2 = new THREE.DirectionalLight(0xaaaaaa, 1.0);
			dirLight2.position.set(1,2,-0.5);
			this.scene.add(dirLight2);
		}
		else
		{
			for(var i = 0; i < WebGLViewerLighting.length; i++)
			{
				this.scene.add(WebGLViewerLighting[i]);
			}
		}
		//origin
		WebGLViewer.origin = new Origin();
		WebGLViewer.origin.update();
		//grid
		WebGLViewer.grid = new Grid();
		WebGLViewer.grid.update();
		//rotation sphere
		WebGLViewer.rotationSphere = new RotationSphere();
		WebGLViewer.rotationSphere.update();
	},
	
	setCameraMode: function(mode)
	{
		if(mode === "ORBIT" || mode === "orbit")
		{
			//enable orbit mode
			this.menuBar.setButtonActive("orbit", true);
			this.controls.setEnabled(true);
			//disable walk mode
			this.menuBar.setButtonActive("walk", false);
			this.controlsWalkMode.setEnabled(false);
			//enable rotation sphere
			this.rotationSphere.setEnabled(true);
		}
		else if(mode === "WALK" || mode === "walk")
		{
			//disable orbit mode
			this.menuBar.setButtonActive("orbit", false);
			this.controls.setEnabled(false);
			//enable walk mode
			this.menuBar.setButtonActive("walk", true);
			this.controlsWalkMode.setEnabled(true);
			//disable rotation sphere
			this.rotationSphere.setEnabled(false);
		}
		else
		{
			console.log("unknown camera mode: "+mode);
		}
	},
	
	/**
	 * Renders the view. Must be invoked, if something has changed (e.g. camera position, colors, geometry, ...).
	 * Normally, this method will be invoked by the methods that changes something in the view or the model.
	 */
	render: function()
	{
		if(this.renderMethod)
			this.renderMethod.call();
	},
	
	/**
	 * Changes the size of the canvas to the specified width and height and adapts the camera settings.
	 * @param {Number} width - the new width in Pixel
	 * @param {Number} height - the new height in Pixel
	 */
	setSize: function(width, height)
	{
		this.width = width;
		this.height = height;
		this.camera.aspect = width/height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
		this.render();
	}
};

var WebGLViewer = new WebGLViewer();
WebGLViewer.initialize();
if ( ! Detector.webgl ) Detector.addGetWebGLMessage();
new CameraViewPanel();
CommentModel.createStandardViews();
