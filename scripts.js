
let defaultMsisdn = "+79152103911"

var layers = {
	markersLayer: L.layerGroup(),
	pointsLayer: L.layerGroup(),
	cities: L.layerGroup(),
	geometry: L.layerGroup(),
	clear: function(){
		this.markersLayer.clearLayers();
		this.pointsLayer.clearLayers();
		this.geometry.clearLayers();
	}
}

var bigMap = undefined;
let maxPointLengthInTooltip = 10;
let prev = undefined;	


let posMethodsColors = {
	8192: "a00100",
	4096: "afafaf",
	2: "123456"

}


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
 	$("#fromTime").val("00:00")
	$("#tillTime").val("23:55")

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
}, false);

function getData(){
	let doRequest = function(type, cb){
		let uri = "http://10.72.12.11:9005";
		let request = new XMLHttpRequest();
		let body = {}
		if(!!~["raw", "processed"].indexOf(type)){
			let dataArrObj = {
				"raw": [12561,16384],
				"processed": [13001,16384]
			} 
			
			
			let getDataArr = dataArrObj[type];
			body = {"sender":"m2m","profile":"poisk","subscriberId":"msisdn"+msisdn,"priority":3,"hideTimes":[{"from":"2018-09-24T03:03:34.477Z","to":"2018-09-24T21:00:00.000Z"}],"sources":["locations"],"inputs":getDataArr,"infolevel":1,"lang":"ru","startTime":fromTime,"endTime":tillTime}
			request.open('POST', uri+ "/ldtdpsvc/rest/v0/ldtd/histvals");

		}else if(!!~["live"].indexOf(type)){
			let literal = {
				"last": "getLast",
				"live": "getOnce"
			} 
			

			body = {"sender":"m2m","profile":"poisk","subscriberId":"msisdn+79152103911","priority":3,"hideTimes":[],"sources":["locations"],"inputs":[12561,16384],"infolevel":1,"lang":"ru","age":60}

			request.open('POST', uri+ "/ldtdpsvc/rest/v0/ldtd/opervals?action="+ literal[type]);
		}

		
		request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
		request.setRequestHeader('Authorization', 'Basic bGR0ZHB1c2VyMTp7QTMlcn1zb342dmI=');
		request.setRequestHeader('Accept', 'application/json');

		request.send(JSON.stringify(body));

		request.onreadystatechange = function () {
			

		    if (request.readyState === 4) {
		       let ans = JSON.parse(request.responseText)
		      
		       if(!ans.inputValues && ans.inputs && ans.inputs.length){ans.inputValues = ans.inputs}
		       if(!ans.inputValues){
		       		cb("No data")
		       		return
		       }
		       cb(false, ans)		       

		    }
		}
	}

	layers.clear()

	let msisdn = document.getElementById('msisdn').value


	let fromTime = moment(document.getElementById('fromDate').value + ' ' + document.getElementById('fromTime').value+':59', 'DD.MM.YYYY HH:mm:ss').toISOString()
	let tillTime = moment(document.getElementById('tillDate').value + ' ' + document.getElementById('tillTime').value+':59', 'DD.MM.YYYY HH:mm:ss').toISOString()

	if($("#processedDataCheck:checked").length){
		doRequest('processed', function(err, data){
			if(err){
				alert(err)
				return;
			}
			draw(data, 'processed')
		})
	}
	if($("#rawDataCheck:checked").length){
		doRequest('raw', function(err, data){
			if(err){
				alert(err)
				return;
			}
			draw(data, 'raw')
		})
	}
	if($("#liveDataCheck:checked").length){
		doRequest('live', function(err, data){
			if(err){
				alert(err)
				return;
			}
			draw(data, 'live')
		})
	}
}

let draw = function(markers, type){
	let countRepeats = 1;
	let usedCoords = {};
	let index = 0;
	let lineCoords = [];

	let colors = pointsColors;
	for ( let i in markers.inputValues)
	{
		let currentMarker =  markers.inputValues[i];
		
		
		let coords = [currentMarker.inputs[0].v.latitude, currentMarker.inputs[0].v.longitude,];
		let radius = currentMarker.inputs[0].v.radius
		let currentTime = moment(currentMarker.inputs[1].v).format("HH:mm:ss DD.MM")

		
		//if (""+coords != ""+prev){

			lineCoords.push(coords);
			index ++;

			if(!usedCoords[""+coords]){
				usedCoords[""+coords] = [[currentTime, i]];
			}else{
				usedCoords[""+coords].push([currentTime, i]);
			}

			let text = 
				"<b>Радиус:</b> "+radius+"<br>"+
				"<b>Время:</b> "+ currentTime

			if(usedCoords[""+coords].length > 1){
				text+="<br><b>Был там:</b> "+usedCoords[""+coords].length + "<br>"+usedCoords[""+coords].map(el => "<i>"+ el[1] +"</i>) "+ el[0]).join("<br />")+""
				text = usedCoords[""+coords].map(el => el[1]).join(", ")+"</b><br />"+text
			}else{
				text = i+"</b><br />"+text
			}
			text = "<b>Точка № "+ text;

			let circle = L.circle([currentMarker.inputs[0].v.latitude, currentMarker.inputs[0].v.longitude],{radius: radius, weight: .5, color: colors[type].circleBorder, fillColor: colors[type].circle, fillOpacity: .05});
			let cCenter = L.circleMarker([currentMarker.inputs[0].v.latitude, currentMarker.inputs[0].v.longitude],{radius: 5, weight: 1, color: colors[type].pointBorder, fillColor: colors[type].point});


			//if (usedCoords[""+coords].length > maxPointLengthInTooltip)
			cCenter.bindPopup(text).bindTooltip(text, {className: 'myTooltip'})
			circle.bindTooltip(text, {className: 'myTooltip'})
			circle.addTo(layers.markersLayer)
			cCenter.addTo(layers.pointsLayer)
			
			timeStart = currentTime
			
		//}	
		countRepeats = 1;
		prev = ""+coords;
		//if(index == 7)break;


	}
	if(type == "live")return;
	var polyline = L.polyline(lineCoords, {color: colors[type].track, weight:1}).addTo(layers.geometry);
	bigMap.fitBounds(polyline.getBounds());
	
	//L.geoJSON({"type": "LineString",	"coordinates":lineCoords}).addTo(layers.geometry);

	
	
}

var mapInit = function(){
	var mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

	var grayscale   = L.tileLayer(mbUrl, {id: 'mapbox.light'}),
		streets  = L.tileLayer(mbUrl, {id: 'mapbox.streets'});


	bigMap = L.map('map', {
		center: [55.751244, 37.618423],
		zoom: 12,
		layers: [grayscale, layers.cities, layers.geometry, layers.markersLayer, layers.pointsLayer]
	});

	var baseLayers = {
		"Grayscale": grayscale,
		"Streets": streets
	};

	var overlays = {
		"Трек": layers.geometry,
		"Радиусы":layers.markersLayer,
		"Точки":layers.pointsLayer
	};
	

	L.control.layers(baseLayers, overlays).addTo(bigMap);

	
}

