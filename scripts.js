
let defaultMsisdn = "+79152103911"

var layers = {
	markersLayer: L.layerGroup(),
	pointsLayer: L.layerGroup(),
	cities: L.layerGroup(),
	geometry: L.layerGroup(),
	geozones: L.layerGroup(),
	clear: function(){
		this.markersLayer.clearLayers();
		this.pointsLayer.clearLayers();
		this.geometry.clearLayers();
		this.geozones.clearLayers();
		$("div.pointInfo").html("<i>Click on point to get it data</i>")
	}
}

var bigMap = undefined;
let maxPointLengthInTooltip = 10;
let prev = undefined;	


//init date & time
$( function() {
    var dateFormat = "dd.mm.yy",
      fromDate = $( "#fromDate" ).datepicker({dateFormat: dateFormat, maxDate: new Date()}).on( "change", function() {
        	tillDate.datepicker( "option", "minDate", getDate( this ) );
        }),
      tillDate = $( "#tillDate" ).datepicker({dateFormat: dateFormat, maxDate: new Date()}).on( "change", function() {
        	fromDate.datepicker( "option", "maxDate", getDate( this ) );
      	});

    fromDate.datepicker('setDate', new Date());
    tillDate.datepicker('setDate', new Date())

    function getDate( element ) {
      var date;
      try {
        date = $.datepicker.parseDate( dateFormat, element.value );
      } catch( error ) {
        date = null;
      }
 
      return date;
    }
    $("#msisdn").val(defaultMsisdn);

    let tpParams = {
	    timeFormat: 'HH:mm',
	    interval: 30,
	    maxTime: '23:59',
	    defaultTime: '00:00',
	    startTime: '00:00',
	    dynamic: false,
	    dropdown: true,
	    scrollbar: true
	}
    $('#fromTime').timepicker(tpParams);
    tpParams.defaultTime = '23:59'
	$('#tillTime').timepicker(tpParams);
} );

document.addEventListener("DOMContentLoaded", function() {
	mapInit()
	getData()
});




document.addEventListener('click', function (event) {	
	if (event.target.matches('#submit')){
		getData()
	}
	if(event.target.matches('#clear')){
		layers.clear()
	}

	if(event.target.matches('#csv')){
		layers.clear()
	}

	
}, false);


let drawCsv = function(csvData){
	layers.clear()
	let csvToJson = function(csv){
			let answer = [];
			let objKeys = [];
			let lines = csv.split('\n');
		    for(let i = 0; i < lines.length; i++){
		    	if (lines[i] == "")continue;
		    	let colomns = lines[i].split(',') 
		    	let obj = {};
		    	for(let j = 0; j < colomns.length; j++){
		      		let val = colomns[j];
		      		
		      		if (i == 0){ 
						objKeys.push(val.trim());
		      		}else{
		      			obj[objKeys[j]] = val;
		      		}
		  		}
		  		if(i != 0)answer.push(obj);
		    }

		    return answer;
		}

	let data = csvToJson(csvData).map(el => {
		let obj = {};
		obj.lon = +el.lon;
		obj.lat = +el.lat;
		obj.radius = +el.radius;
		obj.text = el.text;
		obj.color = el.color;	
		return obj;
	})

	
	let csvColors = csvSettings; //from colors.json
	let trackCoords = [];
	let circlesArr = [];
	for(let i in data){
		let zone = data[i];
		if(!zone.color)zone.color = csvColors.defaultColor;
		trackCoords.push([zone.lat, zone.lon])
		var circle = L.circle([zone.lat, zone.lon],{radius: zone.radius, weight:0, fillColor: zone.color, fillOpacity: csvColors.opacity});
		circle.bindTooltip(zone.text, {className: 'myTooltip'})
		circlesArr.push(circle);
		
	}
	var featureGroup = L.featureGroup(circlesArr).addTo(layers.markersLayer);
	L.polyline(trackCoords, {color: csvColors.track.color, weight:csvColors.track.weight}).addTo(layers.geometry);
	
	bigMap.fitBounds(featureGroup.getBounds());
	
}

function getData(){
	
	let requestAndDraw = function(types){
		let doRequest = function(type, cb){
			let uri = "http://10.72.12.11:9005";
			let request = new XMLHttpRequest();
			let body = {"sender":"m2m","profile":"poisk","subscriberId":"msisdn"+msisdn,"priority":3,"hideTimes":[],"sources":["locations"],"inputs":undefined,"infolevel":1,"lang":"ru","startTime":fromTime,"endTime":tillTime}
			if(!!~["raw", "processed"].indexOf(type)){
				let dataArrObj = {
					"raw": [12561,16384],
					"processed": [13001,16384]
				} 
				
				
				body.inputs = dataArrObj[type];
				
				request.open('POST', uri+ "/ldtdpsvc/rest/v0/ldtd/histvals");

			}else if(!!~["last", "live"].indexOf(type)){
				let literal = {
					"last": "getLast",
					"live": "getOnce"
				} 
				
				body.inputs = [12561,16384]
				
				if (type == "live"){
					body.age = 60
					delete body.startTime;
					delete body.endTime;
				}

				request.open('POST', uri+ "/ldtdpsvc/rest/v0/ldtd/opervals?action="+ literal[type]);
			}

			
			request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
			request.setRequestHeader('Authorization', 'Basic bGR0ZHB1c2VyMTp7QTMlcn1zb342dmI=');
			request.setRequestHeader('Accept', 'application/json');

			request.send(JSON.stringify(body));

			request.onreadystatechange = function () {
				

			    if (request.readyState === 4) {
			   	   if(request.responseText){
				       let ans = JSON.parse(request.responseText)
				      
				       if(!ans.inputValues && ans.inputs && ans.inputs.length){ans.inputValues = ans.inputs;delete ans.inputs;}
				       if(!ans.inputValues){
				       		cb("No data")
				       		return
				       }

				       cb(false, ans)	
				       return;
				   }
			       cb("Error on loading data \""+ type +"\"")    

			    }
			}
		}


		for(var i in types){
			let curType = types[i];
			if($("#"+ curType +"DataCheck:checked").length){

				$("#"+ curType +"Loader").css("display", "inline-block");
				$("#"+ curType +"DataCheck").hide()
				doRequest(curType, function(err, data){
					$("#"+ curType +"Loader").hide();
					$("#"+ curType +"DataCheck").css("display", "inline-block");
					if(err){
						if(err == "No data"){
							$("#"+ curType +"NoData").css("display", "inline-block");
						}else{
							alert(err)	
						}
						return;
					}
					draw(data, curType)
				})
			}
		}		
	}

	let drawGeozones = function(){
		let magicEmpiricalNumber = 62661.2321733;
		let doRequest = function(cb){

			let uri = "geozones.json";//"http://10.72.12.98:50001/geo?msisdn="+msisdn;
			let request = new XMLHttpRequest();
			request.open('GET', uri);
			request.send();

			request.onreadystatechange = function () {		
			    if (request.readyState === 4) {
					try{
						let ans = JSON.parse(request.responseText)				      
				    	cb(false, ans)	
				    	return;
				    }catch(err){
				    	cb(err)
				    	return
				    }
				    cb("Can't get geozones");
				    return;
				}
			}
		}
		let geoArr = [];
		let gzSettings = geozonesSettings; //from colors.json
		doRequest(function(err, data){
			if(err){
				console.log(err);//alert(err)	
				return;
			}
			console.log("geozones", data)
			geoArr = data.map(gz => {
				let text = "<b>Название: </b>"+gz.name
				if(gz.poiArea.length){
					return L.polygon(gz.poiArea, {color: gzSettings.border.color, weight:gzSettings.border.weight, fillColor: gzSettings.color, fillOpacity: gzSettings.opacity}).bindTooltip(text, {className: 'myTooltip'});
				}else{ //cirle
					let radius =  Math.round(gz.poiCenter[2]*magicEmpiricalNumber)
					console.log(gz.name, gz.poiCenter, radius)
					text += "<br><b>Радиус:</b> "+ radius
					return L.circle([gz.poiCenter[0], gz.poiCenter[1]],{radius: radius, color: gzSettings.border.color, weight:gzSettings.border.weight, fillColor: gzSettings.color, fillOpacity: gzSettings.opacity}).bindTooltip(text, {className: 'myTooltip'});
				}
			}).filter(el => el);
			L.featureGroup(geoArr).addTo(layers.geozones);
		})
	}

	let msisdn = document.getElementById('msisdn').value


	let fromTime = moment(document.getElementById('fromDate').value + ' ' + document.getElementById('fromTime').value+':59', 'DD.MM.YYYY HH:mm:ss').toISOString()
	let tillTime = moment(document.getElementById('tillDate').value + ' ' + document.getElementById('tillTime').value+':59', 'DD.MM.YYYY HH:mm:ss').toISOString()


	layers.clear()
	$("noData[id$=NoData]:visible").hide();
	drawGeozones()
	requestAndDraw(['raw', 'processed', 'live', 'last'])
}

let draw = function(markers, type){
	let countRepeats = 1;
	let usedCoords = {};
	let index = 0;
	let lineCoords = [];

	let colors = pointsColorsSettings;  //from colors.json
	
	if(type == "live"){
		if(!markers.inputValues[0].value){
			$("#liveNoData").css("display", "inline-block");
			return;
		}
		markers.inputValues = markers.inputValues.map(el => {
			el.v = el.value;
			el.i = el.input;
			delete el.value;
			delete el.input;
			return el;
		})

		markers.inputValues = [{inputs: markers.inputValues}]
	}

	for ( let i in markers.inputValues)
	{
		let currentMarker =  markers.inputValues[i];

		let coords = [currentMarker.inputs[0].v.latitude, currentMarker.inputs[0].v.longitude];
		let radius = currentMarker.inputs[0].v.radius
		let currentTime = moment(currentMarker.inputs[1].v).format("HH:mm:ss DD.MM")
		
		
		lineCoords.push(coords);
		index ++;

		if(!usedCoords[""+coords]){
			usedCoords[""+coords] = [[currentTime, i]];
		}else{
			usedCoords[""+coords].push([currentTime, i]);
		}


		

		let text = "<b>Радиус:</b> "+radius+"<br>"
		let pointsListText = ""

		text+="<b>Был там:</b> "+usedCoords[""+coords].length + "<br>"
		pointsListText+=usedCoords[""+coords].map(el => "<i>"+ el[1] +"</i>) "+ el[0]).join("<br />")+""
		if (usedCoords[""+coords].length <= maxPointLengthInTooltip){
			text += pointsListText;
		}else{
			text += "Click it!"
		}

		
		if(type == "raw"){
			let posMethod = currentMarker.inputs[0].v.pos_method;
			colors[type].point.border.color = colors[type].point.borders[posMethod];
			colors[type].point.background = colors[type].point.backgrounds[posMethod];
		}

		var circle  = L.circle(      coords,{radius: radius, weight: colors[type].circle.border.weight, color: colors[type].circle.border.color, fillColor: colors[type].circle.background, fillOpacity: .05});
		let cCenter = L.circleMarker(coords,{text:pointsListText, radius: 10,     weight: colors[type].point.border.weight,  color: colors[type].point.border.color, fillColor: colors[type].point.background});


		if (usedCoords[""+coords].length > maxPointLengthInTooltip)

		cCenter.bindTooltip(text, {className: 'myTooltip'})
		circle.bindTooltip(text, {className: 'myTooltip'})
		circle.addTo(layers.markersLayer).on('click', function(e){
			$("div#pointInfo").html(e.target.options.text)
			console.log("11",e)
		})
		cCenter.addTo(layers.pointsLayer).on('click', function(e){
			$("div#pointInfo").html(e.target.options.text)
			console.log("11",e)
		})
		
			
		
		countRepeats = 1;
		prev = ""+coords;
	}
	var polyline = L.polyline(lineCoords, {color: colors[type].track.color, weight:colors[type].track.weight}).addTo(layers.geometry);

	//check if we're loading tracks and fit to track or to point
	let check = (!!~["live", 'last'].indexOf(type)) && ($("#rawDataCheck:checked").length || $("#processedDataCheck:checked").length);
	if (!check){
		bigMap.fitBounds(polyline.getBounds());
	}else{
		bigMap.fitBounds(circle.getBounds());
	}
}

var mapInit = function(){
	var mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

	var grayscale   = L.tileLayer(mbUrl, {id: 'mapbox.light'}),
		streets  = L.tileLayer(mbUrl, {id: 'mapbox.streets'});


	bigMap = L.map('map', {
		center: [55.751244, 37.618423],
		zoom: 12,
		layers: [grayscale, layers.cities, layers.geometry, layers.markersLayer, layers.pointsLayer]//, layers.geozones]
	});

	var baseLayers = {
		"Grayscale": grayscale,
		"Streets": streets
	};

	var overlays = {
		"Трек": layers.geometry,
		"Радиусы": layers.markersLayer,
		"Точки": layers.pointsLayer,
		"Геозоны": layers.geozones
	};

	L.control.layers(baseLayers, overlays).addTo(bigMap);
}


let openCsv = function(e){
	var input = e.target;

    var reader = new FileReader();
    reader.onload = function(){
		//let result = reader.result;
		drawCsv(reader.result)
    };
    reader.readAsText(input.files[0]);
}