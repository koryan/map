
let defaultMsisdn = "+79152103911"


var layers = {
	markersLayer: L.layerGroup(),
	pointsLayer: L.layerGroup(),
	cities: L.layerGroup(),
	csv: L.layerGroup(),
	geozones: L.layerGroup(),
	cells: L.layerGroup(),
	cellsZones: L.layerGroup(),
	clear: function(){
		for(var i in this){
			if(i != "clear")this[i].clearLayers();
		}
		$("div.pointInfo").html("<i>Click on point to get it data</i>")
	}
}

var bigMap = undefined;
var globalSettings = undefined;

//get settings
$.get("settings.json").done(function(data){
	try{
		if(typeof data == "object"){
			globalSettings  = data
		}else{
			globalSettings = JSON.parse(data)
		}
		$("body").removeClass("loading")
		mapInit()

	}catch(err){
		console.error(err)
		$("body").html("<h1 id='settingsLoadError'>Парус!! Порвали парус!<br /><span>Проверь валидность settings.json</span><pre>"+err+"</pre></h1>")
	}
}).fail(function(err){
	console.error(err)
	if(typeof err == "object")err = JSON.stringify(err)
	$("body").html("<h1 id='settingsLoadError'>Парус!! Порвали парус!<br /><span>Проверь доступность settings.json</span><pre>"+err+"</pre></h1>")
	
})


//init date & time
$( function() {
    var dateFormat = "dd.mm.yy",
      fromDate = $( "#fromDate" ).datepicker({firstDay: 1, dateFormat: dateFormat, maxDate: new Date()}).on( "change", function() {
        	tillDate.datepicker( "option", "minDate", getDate( this ) );
        }),
      tillDate = $( "#tillDate" ).datepicker({firstDay: 1, dateFormat: dateFormat, maxDate: new Date()}).on( "change", function() {
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
	
	//getData()
	$('#putIvansNumber').click(function(){
		$("#msisdn").val(defaultMsisdn);
	})

	// $("#clear").click(function(){
	// 	layers.clear()
	// })



	$('.buttons>*').click(function(e){
		let type = e.currentTarget.id
		if(!!~['raw','processed', 'live', 'last', 'geozones', 'cellTowers'].indexOf(type)){
			getData(type)
		}else if(!!~['clear'].indexOf(type)){
			layers.clear()
		}
	})

	if(window.location.protocol == "file:"){
		$("#msisdn").val(defaultMsisdn);
	}
});





let drawCsv = function(csvData){
	console.log(layers)
	//layers.csv.clear()
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

	
	let csvColors = globalSettings.colors.csv; //from colors.json
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
	L.polyline(trackCoords, {color: csvColors.track.color, weight:csvColors.track.weight}).addTo(layers.csv);
	
	bigMap.fitBounds(featureGroup.getBounds());
	
}

function getData(type){
	
	let doRequest = function(type, cb){
		let uri = undefined;
		let params = {};
		let genParamsString = function(params){
			return Object.keys(params).map(el => {
				return el.trim()+"="+params[el].toString().trim()
			}).join("&")
		}
		switch(type){
			case "geozones":
				uri = "http://10.72.12.98/geo?msisdn="+msisdn;
				break;
			case 'raw':
			case 'last':
			case 'processed':
				params = {
					msisdn: msisdn,
					type: type,
					startTime: fromTime,
					endTime: tillTime
				}
				
				
				uri = "http://10.72.12.98:80/coords?"+genParamsString(params);
				break;
			case 'live':
				params = {
					msisdn: msisdn,
					type: type
				}
				uri = "http://10.72.12.98:80/coords?"+ genParamsString(params);
				break;
			case 'cellTowers':
				params = {
					latb: bigMap.getBounds().getNorthWest().lat,
					lonb: bigMap.getBounds().getNorthWest().lng,
					lata: bigMap.getBounds().getSouthEast().lat,
					lona: bigMap.getBounds().getSouthEast().lng
				}
				uri = "http://10.72.12.98:80/cells?"+genParamsString(params);
				break;
			default: 
				cb("Wrong data type");
				return;
				break;
		}
		
		$("#"+ type +">smallLoader").css("display", "block")
		$("#"+ type +">span").css("visibility", "hidden");
		$("#"+ type).prop( "disabled", true ).addClass("loading");
		fetch(uri).then(function(response){

			$("#"+ type +">smallLoader").css("display", "none")
			$("#"+ type +">span").css("visibility", "visible");
			$("#"+ type).prop( "disabled", false ).removeClass("loading");;

			if(response.status !== 200){
				cb(response.status, response)
				return;
			}
			
			response.text().then(function(data) {  
				if(data.length == 0){
					cb(false, [])
					return;
				}
				cb(false, JSON.parse(data))	
		    })
	    }).catch(function(err) {  
	    	$("#"+ type +">smallLoader").css("display", "none")
			$("#"+ type +">span").css("visibility", "visible");
			$("#"+ type).prop( "disabled", false ).removeClass("loading");;

		    cb(err);
		});
		
	}

	let drawPoints = function(type){
		
		let draw = function(markers, type){
			let countRepeats = 1;
			let usedCoords = {};
			let index = 0;
			let lineCoords = [];

			let colors = globalSettings.colors.points;  //from colors.json
			
			if(type == "live"){
				if(!markers.inputValues[0].value){
					$("#live>noData").css("display","inline-block");
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
				if (usedCoords[""+coords].length <= globalSettings.maxPointLengthInTooltip){
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
				let cCenter = L.circleMarker(coords,{text:pointsListText, radius: 5,     weight: colors[type].point.border.weight,  color: colors[type].point.border.color, fillColor: colors[type].point.background});


				if (usedCoords[""+coords].length > globalSettings.maxPointLengthInTooltip)

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
			console.log(type,colors[type])
			var polyline = L.polyline(lineCoords, {color: colors[type].track.color, weight:colors[type].track.weight}).addTo(layers.csv);

			//check if we're loading tracks and fit to track or to point
			let check = (!!~["live", 'last'].indexOf(type));
			if (!check){
				bigMap.fitBounds(polyline.getBounds());
			}else{
				bigMap.fitBounds(circle.getBounds());
			}
		}

		doRequest(type, function(err, data){
			if(err){
					console.log(err, data)
					alert("Ошибка загрузки данных")	
				return;
			}

			//rename values for live data
			if(type == "live" && !data.inputValues && data.inputs && data.inputs.length){data.inputValues = data.inputs;delete data.inputs;}
			if(!data.inputValues){
				$("#"+ type +">noData").css("display","inline-block");
				return
			}
			draw(data, type)
		})
	}

	let drawGeozones = function(){
		let magicEmpiricalNumber = 62661.2321733;
		let geoArr = [];
		let gzSettings = globalSettings.colors.geozones
		
		doRequest("geozones", function(err, data){		
			if(err){
				alert("Ошибка загрузки геозон")
				console.log(err);
				return;
			}
			geoArr = data.map(gz => {
				let text = "<b>Название: </b>"+gz.name
				let bgColor = (gz.attrs && gz.attrs.color)? gz.attrs.color: gzSettings.defaultColor;
				if(gz.poiArea.length){
					return L.polygon(gz.poiArea, {color: gzSettings.border.color, weight:gzSettings.border.weight, fillColor: bgColor, fillOpacity: gzSettings.opacity}).bindTooltip(text, {className: 'myTooltip'});
				}else{ //cirle
					let radius =  Math.round(gz.poiCenter[2]*magicEmpiricalNumber)
					text += "<br><b>Радиус:</b> "+ radius
					return L.circle([gz.poiCenter[0], gz.poiCenter[1]],{radius: radius, color: gzSettings.border.color, weight:gzSettings.border.weight, fillColor: bgColor, fillOpacity: gzSettings.opacity}).bindTooltip(text, {className: 'myTooltip'});
				}
			}).filter(el => el);
			L.featureGroup(geoArr).addTo(layers.geozones);
		})
	}

	let drawTowers = function(){
		if(bigMap.getBounds().getNorth() - bigMap.getBounds().getSouth() > globalSettings.maxMapSizeForCellTowers && 
			bigMap.getBounds().getEast() - bigMap.getBounds().getWest() > globalSettings.maxMapSizeForCellTowers){
			alert("Слишком большой масштаб карты");
			return;
		}

		let towersArr = [];
		let radiusesArr = [];
		let createText = function(obj){
			
			return Object.keys(obj).map((i) => "<b>"+i+":</b> "+obj[i]).join("<br>");
		}
		doRequest("cellTowers", function(err, data){		
			if(err){
				alert("Ошибка загрузки вышек")
				console.log(err);
				return;
			}
			let cellSettings = globalSettings.colors.points.towerCells; 
			for(i in data){
				let cell = data[i];
				let text = createText({id:cell.id,radius: cell.max_radius, lac: cell.lac})
				console.log(text)
				radiusesArr.push(L.circle([cell.lat, cell.lon],{radius: cell.max_radius, color: cellSettings.circle.border.color, weight:cellSettings.circle.border.weight, fillColor: cellSettings.circle.background, fillOpacity: cellSettings.circle.opacity}).bindTooltip(text, {className: 'myTooltip'}))
				towersArr.push(L.circleMarker([cell.lat, cell.lon],{text:text, radius: cellSettings.point.radius,     weight: cellSettings.point.border.weight,  color: cellSettings.point.border.color, fillColor: cellSettings.point.background, fillOpacity: cellSettings.point.opacity}).bindTooltip(text, {className: 'myTooltip'}))
			}
			L.featureGroup(radiusesArr).addTo(layers.cellsZones);
			L.featureGroup(towersArr).addTo(layers.cells);
			
		})
	}

	$("#"+type+">noData:visible").hide();
	
	$('#msisdn.error').removeClass("error");
	let msisdn = document.getElementById('msisdn').value
	
	if(!msisdn || msisdn == ""){
		$('#msisdn').addClass("error");
		return;
	}
	
	
	if (type == 'geozones'){
		drawGeozones()
	}else if(type == 'cellTowers'){
		

		drawTowers()
	}else{

		var fromTime = moment(document.getElementById('fromDate').value + ' ' + document.getElementById('fromTime').value+':59', 'DD.MM.YYYY HH:mm:ss').toISOString()
		var tillTime = moment(document.getElementById('tillDate').value + ' ' + document.getElementById('tillTime').value+':59', 'DD.MM.YYYY HH:mm:ss').toISOString()

		drawPoints(type)
	}
	
	
}



var mapInit = function(){
	var mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

	var grayscale   = L.tileLayer(mbUrl, {id: 'mapbox.light'}),
		streets  = L.tileLayer(mbUrl, {id: 'mapbox.streets'});

	var onZoom = function(){
		let check = bigMap.getBounds().getNorth() - bigMap.getBounds().getSouth() > globalSettings.maxMapSizeForCellTowers && 
			bigMap.getBounds().getEast() - bigMap.getBounds().getWest() > globalSettings.maxMapSizeForCellTowers
		$("#cellTowers").prop( "disabled", check );
		
		//$("#cellTowers").prop( "title", $("#cellTowers").prop("correctTitle"))
		$("#cellTowers").prop( "title", (!check)? $("#cellTowers").attr("correctTitle"):$("#cellTowers").attr("wrongTitle"))
	}

	bigMap = L.map('map', {
		center: [55.751244, 37.618423],
		zoom: 12,
		layers: [grayscale, layers.cities, layers.csv, layers.markersLayer, layers.pointsLayer, layers.geozones, layers.cellsZones, layers.cells]
	}).on('zoomend', function() {
    	onZoom();
	});;

	
	
	var baseLayers = {
		"Grayscale": grayscale,
		"Streets": streets
	};

	var overlays = {
		"Трек": layers.csv,
		"Радиусы": layers.markersLayer,
		"Точки": layers.pointsLayer,
		"Геозоны": layers.geozones,
		"Вышки": layers.cells,
		"Вышки c зоной": layers.cellsZones
	};

	L.control.layers(baseLayers, overlays).addTo(bigMap);

	onZoom();
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