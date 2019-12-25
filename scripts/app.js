
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
let copyToClipboard = function(text) {
    var $temp = $("<input>");
    $("body").append($temp);
    $temp.val(text).select();
    document.execCommand("copy");
    $temp.remove();
}

let showFail = function(failTxt, comment){
	$("body").html("<h1 id='settingsLoadError'>Парус!! Порвали парус!<br />"+ ((comment)?"<span>"+comment+"</span>":"") +"<pre>"+failTxt+"</pre></h1>")
}

let showError = function(text){
	let err = $("<error><p>"+text+"</p><error>")
	$("#errors").append(err)
	err.addClass("on")
	setTimeout(() => {
		err.remove()
	}, 1500)
}

var bigMap = undefined;
var globalSettings = undefined;



//get settings
$.get("./settings.json").done(function(data){

	if(typeof data == "object"){
		globalSettings  = data
	}else{
		try{
			globalSettings = JSON.parse(data)
		}catch(err){
			console.error(err)
			showFail(err, "Проверь валидность settings.js");		
			return;
		}
	}
	$("body").removeClass("loading")
	
	try{
		mapInit()
	}catch(err){
		console.error(err)
		showFail(err, "Сломалась карта")
	}

}).fail(function(err){
	console.error(err)
	if(typeof err == "object")err = JSON.stringify(err)
	showFail(err, "Проверь доступность settings.js")	
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

	$('#msisdn').on('keyup', function(event){
		 if (event.keyCode === 13) {
		 	 event.preventDefault();
		 	 $('.buttons>#processed').click()
		 }
	})

	$('.buttons>*').click(function(e){

		let type = e.currentTarget.id
		if(!!~['raw','processed', 'live', 'last', 'geozones', 'cellTowers'].indexOf(type)){
			getData(type)
		}else if(!!~['clear'].indexOf(type)){
			layers.clear()
			$("#info").html("")
		}
	})

	//temp for local work )
	if(window.location.protocol == "file:"){
		$("#msisdn").val(defaultMsisdn);
	}

});




function getData(type){
	let doRequest = function(type, cb){
		let uri = "http://10.72.12.98/";
		let params = {};
		let genParamsString = function(params){
			return Object.keys(params).map(el => {
				return el.trim()+"="+params[el].toString().trim()
			}).join("&")
		}
		switch(type){
			case "geozones":
				uri += "geo?msisdn="+msisdn;
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
				
				
				uri += "coords?"+genParamsString(params);
				break;
			case 'live':
				params = {
					msisdn: msisdn,
					type: type
				}
				uri += "coords?"+ genParamsString(params);
				break;
			case 'cellTowers':
				params = {
					latb: bigMap.getBounds().getNorthWest().lat,
					lonb: bigMap.getBounds().getNorthWest().lng,
					lata: bigMap.getBounds().getSouthEast().lat,
					lona: bigMap.getBounds().getSouthEast().lng
				}
				uri += "cells?"+genParamsString(params);
				break;
			default: 
				cb("Wrong data type");
				return;
				break;
		}
		
		let loader = {
			set: () => {
				$("#"+ type +">smallLoader").css("display", "block")
				$("#"+ type +">span").css("visibility", "hidden");
				$("#"+ type).prop( "disabled", true ).addClass("loading");
			},
			clear: () => {
				$("#"+ type +">smallLoader").css("display", "none")
				$("#"+ type +">span").css("visibility", "visible");
				$("#"+ type).prop( "disabled", false ).removeClass("loading");
			}
		}
		loader.set();
		fetch(uri).then(function(response){

			loader.clear();

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
	    	loader.clear();
		    cb(err);
		});
		
	}

	let drawPoints = function(type, data){
		
		//rename values for live data
		if(type == "live"){
			data.inputValues = data.inputs;
			delete data.inputs;

			if(!data.inputValues[0].value){
				$("#live>noData").css("display","inline-block");
				return;
			}
			data.inputValues = data.inputValues.map(el => {
				el.v = el.value;
				el.i = el.input;
				delete el.value;
				delete el.input;
				return el;
			})

			data.inputValues = [{inputs: data.inputValues}]
		}

		if(!data.inputValues){
			$("#"+ type +">noData").css("display","inline-block");
			return
		}

		

		let usedCoords = {};
		let lineCoords = [];
		let pointsList = [];

		let colors = globalSettings.colors.points;  //from colors.json
		
		let createText = function(obj){
			return Object.keys(obj).map((i) => "<b>"+i+":</b> "+obj[i]).join("<br>");
		}

		for (let i in data.inputValues){
			let currentMarker =  data.inputValues[i];

			let coords = [currentMarker.inputs[0].v.latitude, currentMarker.inputs[0].v.longitude];
			let radius = currentMarker.inputs[0].v.radius
			let currentTime = moment(currentMarker.inputs[1].v).format("HH:mm:ss DD.MM")
			

			
			lineCoords.push(coords);

			if(!usedCoords[""+coords]){
				usedCoords[""+coords] = [[currentTime, i]];
			}else{
				usedCoords[""+coords].push([currentTime, i]);
			}


			
			let info = [coords[0], coords[1], currentTime, radius]
			let text = "<b>Радиус:</b> "+radius+"<br>"
			let pointsListText = ""

			text+="<b>Был там:</b> "+usedCoords[""+coords].length + "<br>"
			pointsListText+=usedCoords[""+coords].map(el => "<i>"+ (+el[1] + 1) +"</i>) "+ el[0]).join("<br />")+""
			if (usedCoords[""+coords].length <= globalSettings.maxPointLengthInTooltip){
				text += pointsListText;
			}else{
				text += "Click it!"
			}

			
			if(type == "raw"){
				let posMethod = currentMarker.inputs[0].v.pos_method;
				info.push(posMethod);
				colors[type].point.border.color = colors[type].point.borders[posMethod];
				colors[type].point.background = colors[type].point.backgrounds[posMethod];
			}

			let items = {
				circle	: L.circle(      coords,{type: "circle", text:pointsListText, radius: radius, weight: colors[type].circle.border.weight, color: colors[type].circle.border.color, fillColor: colors[type].circle.background, fillOpacity: colors[type].circle.opacity}),
				point	: L.circleMarker(coords,{type: "point", text:pointsListText, radius: 7,      weight: colors[type].point.border.weight,  color: colors[type].point.border.color, fillColor: colors[type].point.background})
			}

			//if (usedCoords[""+coords].length > globalSettings.maxPointLengthInTooltip)

			for(var j in items){
				items[j].bindTooltip(text, {className: 'myTooltip'})
				

				items[j].on('click', function(e){
					$("div#pointInfo").html(e.target.options.text)
				})
				items[j].on('mouseover', function(e){

					this.setStyle({
						fillOpacity: colors[type][e.target.options.type].opacity + .2,
						weight: colors[type][e.target.options.type].border.weight + 2
					})
					$("tr[textForPoint="+i+"]").addClass("hoverLike")
				})
				items[j].on('mouseout', function(e){
					this.setStyle({
						fillOpacity: colors[type][e.target.options.type].opacity,
						weight: colors[type][e.target.options.type].border.weight
					})
					$("tr[textForPoint="+i+"]").removeClass("hoverLike")
				})

				items[j].addTo(((j == "circle")?layers.markersLayer:layers.pointsLayer))
			}

			
			pointsList.push({
				items: items,
				info: info,
				//text: "<tr textForPoint='"+i+"'><td>"+ i +"</td><td>"+ currentTime +"</td><td>"+radius+"</td></tr>"
			});
			
			
				
			
			countRepeats = 1;
			prev = ""+coords;
		}
		
		var polyline = L.polyline(lineCoords, {color: colors[type].track.color, weight:colors[type].track.weight}).addTo(layers.csv);

		//check if we're loading tracks and fit to track or to point
		let check = (!!~["live", 'last'].indexOf(type));
		if (!check){
			bigMap.fitBounds(polyline.getBounds());
		}else{
			//bigMap.fitBounds(circle.getBounds());
		}

		let headerArr = ["№", "время", "радиус"]
		if(type == "raw")headerArr.push("pos метод")
		$("#info").html(
			"<div class='totalWrapper'><total>Всего: "+ pointsList.length +"</total>"+
			"<a class='downloadCsv' href='#'><img src='./img/csvDownload.png' /></a></div>"+
			"<scrollable><table class='points'>"+				
				"<thead><tr>"+
					headerArr.map((el) => "<td>"+el+"</td>").join("")+
				"</tr></thead>"+

				"<tbody>"+
				pointsList.map((el, index) => {
					return "<tr textForPoint="+ index +"><td></td><td>"+ el.info.join("</td><td>") + "</td></tr>"
				}).join('')+
				"</tbody>"+
			"</table></scrollable>");
		// $("#info>ul>li").on('click', function(e){
		// 	copyToClipboard($(this).find("span").html())
		// })
		$("#info .downloadCsv").on('click', function(e){
			e.preventDefault();
			let tmpHeaderArr = ["lat", "lon", "time", "radius"]
			if(type == "raw")tmpHeaderArr.push("pos method")
			let tHeader = "<thead><tr>"+
					tmpHeaderArr.map((el) => "<td>"+el+"</td>").join("")+
				"</tr></thead>"
			$("#info").prepend("<table id='tmpForCsv'>"+tHeader+$("table.points tbody").html()+"</table>")
			let fileName = msisdn+"_"+
				moment(fromTime).format("DD.MM-HHmm")+"_"+
				moment(tillTime).format("DD.MM-HHmm");
			$("#tmpForCsv").table2csv("download", {filename: fileName+".csv", quoteFields: false})
			$("#tmpForCsv").remove()
		})

		$("table.points tbody tr").on('mouseenter', function(e){
			let id = $(this).attr("textForPoint")
			for(var item of ['circle', 'point'])
			{
				pointsList[id].items[item].setStyle({
					fillOpacity: colors[type][item].opacity + .2,
					weight: colors[type][item].border.weight + 2
				})
			}
		})
		$("table.points tbody tr").on('mouseleave', function(e){
			let id = $(this).attr("textForPoint")
			for(var item of ['circle', 'point'])
			{
				pointsList[id].items[item].setStyle({
					fillOpacity: colors[type][item].opacity,
					weight: colors[type][item].border.weight
				})
			}		
		})
		
	}

	let drawGeozones = function(data){
		let magicEmpiricalNumber = 62661.2321733;
		let gzSettings = globalSettings.colors.geozones		
		
		let geoArr = data.map(gz => {
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
	}

	let drawTowers = function(data){
		let towersArr = [];
		let radiusesArr = [];
		let cellSettings = globalSettings.colors.points.towerCells; 
		let createText = function(obj){
			
			return Object.keys(obj).map((i) => "<b>"+i+":</b> "+obj[i]).join("<br>");
		}		
		
		for(i in data){
			let cell = data[i];
			let text = createText({id:cell.id,radius: cell.max_radius, lac: cell.lac})

			radiusesArr.push(L.circle([cell.lat, cell.lon],{radius: cell.max_radius, color: cellSettings.circle.border.color, weight:cellSettings.circle.border.weight, fillColor: cellSettings.circle.background, fillOpacity: cellSettings.circle.opacity}).bindTooltip(text, {className: 'myTooltip'}))
			towersArr.push(L.circleMarker([cell.lat, cell.lon],{text:text, radius: cellSettings.point.radius,     weight: cellSettings.point.border.weight,  color: cellSettings.point.border.color, fillColor: cellSettings.point.background, fillOpacity: cellSettings.point.opacity}).bindTooltip(text, {className: 'myTooltip'}))
		}
		L.featureGroup(radiusesArr).addTo(layers.cellsZones);
		L.featureGroup(towersArr).addTo(layers.cells);
	}

	$("#"+type+">noData:visible").hide();	
	$('#msisdn.error').removeClass("error");
	
	let msisdn = document.getElementById('msisdn').value
	let fromTime = moment(document.getElementById('fromDate').value + ' ' + document.getElementById('fromTime').value+':59', 'DD.MM.YYYY HH:mm:ss').toISOString()
	let tillTime = moment(document.getElementById('tillDate').value + ' ' + document.getElementById('tillTime').value+':59', 'DD.MM.YYYY HH:mm:ss').toISOString()

	if(type != "cellTowers" && (!msisdn || !new RegExp(/^\+?7\(*\d{3}\)*\d{7}$/).test(msisdn))){
		$('#msisdn').addClass("error");
		showError('Введите номер абонента')
		return;
	}
	if(msisdn[0] != '+')msisdn = "+"+msisdn
	
	
	doRequest(type, function(err, data){
		if(err){
			console.error(err, data)
	
			showError("Ошибка загрузки данных")	
			return;
		}
		if (type == 'geozones'){
			drawGeozones(data)
		}else if(type == 'cellTowers'){
			drawTowers(data)
		}else{			
			drawPoints(type, data)
		}		
	})
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
		//measureControl: true,
		layers: [grayscale, layers.cities, layers.csv, layers.markersLayer, layers.pointsLayer, layers.geozones, layers.cellsZones, layers.cells]
	}).on('zoomend', function() {
    	onZoom();
	});;
	L.control.measure({
		position: 'topleft',
		lineColor: globalSettings.colors.ruler.color,
		lineWeight: globalSettings.colors.ruler.weight,
		lineOpacity: globalSettings.colors.ruler.opacity

	}).addTo(bigMap)

	$(".leaflet-control-measure").attr("title", 'Рулетка\nM - начать измерение\nEsc - остановить имерение')
	
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

let drawCsv = function(csvData){
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
			if (i != 0){ answer.push(obj); }
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
	
	let csvColors = globalSettings.colors.csv; //from settings.json
	let trackCoords = [];
	let circlesArr = [];
	for (let i in data){
		let zone = data[i];

		if (!zone.color){ zone.color = csvColors.defaultColor; }
		trackCoords.push([zone.lat, zone.lon])
		var circle = L.circle([zone.lat, zone.lon],{radius: zone.radius, weight:0, fillColor: zone.color, fillOpacity: csvColors.opacity});
		circle.bindTooltip(zone.text, {className: 'myTooltip'})
		circlesArr.push(circle);
	}
	var featureGroup = L.featureGroup(circlesArr).addTo(layers.markersLayer);
	L.polyline(trackCoords, {color: csvColors.track.color, weight:csvColors.track.weight}).addTo(layers.csv);
	
	bigMap.fitBounds(featureGroup.getBounds());
}

let openCsv = function(e){
	var input = e.target;

    var reader = new FileReader();
    reader.onload = function(){
		drawCsv(reader.result)
    };
    reader.readAsText(input.files[0]);
}