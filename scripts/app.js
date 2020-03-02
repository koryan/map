
let defaultMsisdn = "+79152103911";
let defaultCell = {cell: 41202, lac: 580};

let overlaysArr = [
	["markersLayer", "Радиусы"],
	["pointsLayer", "Точки"],
	["csv", "Трек"],
	["geozones", "Геозоны"],
	//["cellsZones", "Вышки c радиусом"],
	// ["oneCell", "oneCell"],
	["oneCellPolyWCircles", "oneCellPolyWCircles"],
	["oneCellPoly", "oneCellPoly"],	
	["cellAzimuts", "Ёжики"],
	["cells", "Вышки"],
	['userPoints', 'Статистика']
]

var layers = {	
	clear: function(){
		for(var i in this){
			if(i != "clear")this[i].clearLayers();
		}
		$("div.pointInfo").html("<i>Click on point to get it data</i>")
	}
}
for(let i in overlaysArr){
	layers[overlaysArr[i][0]] = L.layerGroup().setZIndex(i+1);

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

}).fail(function(err, text){
	
	console.error(text, err)
	if(typeof err == "object")err = JSON.stringify(err)
	showFail(err, text)	
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

	$('#putTestCellData').click(function(){
		$("#cellTowerCell").val(defaultCell.cell);
		$("#cellTowerLac").val(defaultCell.lac);
	})
	

	$('#msisdn').on('keyup', function(event){
		 if (event.keyCode === 13) {
		 	 event.preventDefault();
		 	 $('.buttons>#processed').click()
		 }
	})

	$('.buttons>*').click(function(e){

		let type = e.currentTarget.id
		if(!!~['raw','processed', 'live', 'last', 'geozones', 'cellTowers', 'oneCellTower', 'userPoints'].indexOf(type)){
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

	$("input[id^=cellTower]").click(e => {
		e.preventDefault();
		return false;
	})

});




function getData(type){
	let doRequest = function(type, cb){
		let uri = "./api/";
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
			case 'userPoints':
				params = {
					latb: bigMap.getBounds().getNorthWest().lat,
					lonb: bigMap.getBounds().getNorthWest().lng,
					lata: bigMap.getBounds().getSouthEast().lat,
					lona: bigMap.getBounds().getSouthEast().lng,
					startTime: moment(document.getElementById('fromDate').value, "DD.MM.YYYY").format("YYYY-MM-DD") + 'T' + document.getElementById('fromTime').value+':00',
					endTime: moment(document.getElementById('fromDate').value, "DD.MM.YYYY").format("YYYY-MM-DD") + 'T' + document.getElementById('tillTime').value+':00',
					method: $("#userPointsMethod").val()

				}
				uri += "area?"+genParamsString(params);
				break;
			case 'oneCellTower':
				params = oneCellTowerParams
				uri += "poly?"+genParamsString(params);
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

			

			if(response.status !== 200){
				loader.clear();
				cb(response.status, response)
				return;
			}
			
			response.text().then(function(data) {  
				loader.clear();
				if(data.length == 0){
					cb(false, [])
					return;
				}
				try{
					let parsed = JSON.parse(data)
					cb(false, parsed)	
				}catch(e){
					cb(e, e.message)
				}
				
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

			if(!data.inputValues[0]){
				$("#live>noData").css("display","inline-block");
				return;
			}
	
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

			if(type == "processed"){
				let motion = currentMarker.inputs[0].v.motion
				info.push(motion);
				console.log(motion, colors[type].circle.backgrounds["motion"+motion])
				colors[type].circle.background = colors[type].circle.backgrounds["motion"+motion];
				colors[type].point.background = colors[type].point.backgrounds["motion"+motion];
			}
			if(type == "raw"){
				let posMethod = currentMarker.inputs[0].v.pos_method;
				info.push(posMethod);
				colors[type].circle.background = colors[type].circle.backgrounds[posMethod];
				colors[type].point.background = colors[type].point.backgrounds[posMethod];
			}
			let items = {
				circle	: L.circle(      coords,{type: "circle", text:pointsListText, radius: radius, weight: colors[type].circle.border.weight, color: colors[type].circle.border.color, fillColor: colors[type].circle.background, fillOpacity: colors[type].circle.opacity}),
				point	: L.circleMarker(coords,{type: "point", text:pointsListText, radius: colors[type].point.radius,      weight: colors[type].point.border.weight,  color: colors[type].point.border.color, fillColor: colors[type].point.background, fillOpacity: colors[type].point.opacity})
			}

			//if (usedCoords[""+coords].length > globalSettings.maxPointLengthInTooltip)

			for(var j in items){
				items[j].bindTooltip(text, {className: 'myTooltip'})
				

				// items[j].on('click', function(e){
				// 	console.log("click")
				// 	$("div#pointInfo").html(e.target.options.text)
				// })
				items[j].on('mouseover', function(e){
					this.setStyle({
						fillOpacity: colors[type][e.target.options.type].opacity + .2,
						weight: colors[type][e.target.options.type].border.weight + 1
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

		//pointsList = pointsList.reverse()
		let headerArr = ["№", "время", "радиус"]
		if (type == "raw")headerArr.push("pos метод")
		if (type == "processed")headerArr.push("motion")
		$("#info").html(
			"<div class='totalWrapper'><total>Всего: "+ pointsList.length +"</total>"+
			"<a class='downloadCsv' href='#'><img src='./img/csvDownload.png' /></a></div>"+
			"<scrollable><table class='points'>"+				
				"<thead><tr>"+
					headerArr.map((el) => "<td>"+el+"</td>").join("")+
				"</tr></thead>"+

				"<tbody>"+

				pointsList.map((el, index) => {
					

					let rows = el.info.map(row => {
						let color = undefined;
						if(type == "raw")color = globalSettings.colors.points.raw.circle.backgrounds[row]
						if(type == "processed")color = globalSettings.colors.points.processed.circle.backgrounds["motion"+row]
						
						return "<td"+ ((color)?" style='background-color:"+color+"'":"") + ">"+row+"</td>"
					})
					
					return "<tr textForPoint="+ index +"><td></td>"+rows.join('')+"</tr>"
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

	let drawOneTower = function(data){

		let oneTowerSettings = globalSettings.colors.oneCell	
		let polyArr = [];
		let polyCirclesArr = [];
		let cellType = ((data.height >= 0)?"out":"in")+"door";	
		for(var el of data.poly){
			
			polyArr.push(L.polygon	(el.coords, {color: oneTowerSettings[cellType].poly.border.color, weight:oneTowerSettings[cellType].poly.border.weight, fillColor: oneTowerSettings[cellType].poly.background, fillOpacity: oneTowerSettings[cellType].poly.opacity}).bindTooltip("id: "+el.id, {className: 'myTooltip'}));
			
			polyCirclesArr.push(L.circle	(el.center, {radius: el.radius, color: oneTowerSettings[cellType].poly.outerCircle.border.color, weight:oneTowerSettings[cellType].poly.outerCircle.border.weight}))
			polyCirclesArr.push(L.circleMarker(el.center,{radius: 3,    weight: 1,  color: oneTowerSettings[cellType].poly.outerCircle.centerPointColor, fillColor: oneTowerSettings[cellType].poly.outerCircle.centerPointColor, fillOpacity: 1}))
		
			
		}
		

		var featureGroup = L.featureGroup(polyArr).addTo(layers.oneCellPoly);
		//bigMap.fitBounds(featureGroup.getBounds());

		L.featureGroup(polyCirclesArr).addTo(layers.oneCellPolyWCircles);
		

		text = "<b>Lac:</b> "+oneCellTowerParams.lac+"<br /><b>Cell:</b> "+oneCellTowerParams.cell
		L.circleMarker(data.tower,{text:text, radius: oneTowerSettings[cellType].tower.radius,     weight: oneTowerSettings[cellType].tower.border.weight,  color: oneTowerSettings[cellType].tower.border.color, fillColor: oneTowerSettings[cellType].tower.background, fillOpacity: oneTowerSettings[cellType].tower.opacity}).bindTooltip(text, {className: 'myTooltip'}).addTo(layers.oneCellPoly);


		if(data.azimut == 360)return; //no need to draw azimut 
		L.polyline([data.tower, data.coords_end], {color: oneTowerSettings[cellType].azimut.color, weight:oneTowerSettings[cellType].azimut.weight}).addTo(layers.oneCellPoly);

	}

	let drawGeozones = function(data){
		let magicEmpiricalNumber = 62661.2321733;
		let gzSettings = globalSettings.colors.geozones		
		
		let geoArr = data.map((gz, index) => {
			let text = "<b>Название: </b>"+gz.name
			let bgColor = (gz.attrs && gz.attrs.color)? gz.attrs.color: gzSettings.defaultColor;
			let item = undefined;
			if(gz.poiArea.length){
				item = L.polygon(gz.poiArea, {name: gz.name, color: gzSettings.border.color, weight:gzSettings.border.weight, fillColor: bgColor, fillOpacity: gzSettings.opacity}).bindTooltip(text, {className: 'myTooltip'});
			}else{ //cirle
				let radius =  Math.round(gz.poiCenter[2]*magicEmpiricalNumber)
				text += "<br><b>Радиус:</b> "+ radius
				item = L.circle([gz.poiCenter[0], gz.poiCenter[1]],{name: gz.name, radius: radius, color: gzSettings.border.color, weight:gzSettings.border.weight, fillColor: bgColor, fillOpacity: gzSettings.opacity}).bindTooltip(text, {className: 'myTooltip'});
			}
			item.on('mouseover', function(e){
				this.setStyle({
					fillOpacity:  gzSettings.opacity + .2,
					weight: gzSettings.border.weight + 1
				})
				$("tr[textForPoint="+index+"]").addClass("hoverLike")
			})
			item.on('mouseout', function(e){
				this.setStyle({
					fillOpacity:  gzSettings.opacity,
					weight: gzSettings.border.weight
				})
				$("tr[textForPoint="+index+"]").removeClass("hoverLike")
			})
			return item;
		}).filter(el => el);

		L.featureGroup(geoArr).addTo(layers.geozones);
		let html = "<scrollable><table class='geozones points'><thead><tr><td>№</td><td>Название</td></tr></thead><tbody>"+
			geoArr.map((item, index) => {
				
			return "<tr bounds="+JSON.stringify(item.getBounds())+" textForPoint="+ index +"><td></td><td>"+ item.options.name +"</td></tr>"
		}).join("")+"</tbody></table></scrollable>";
		$("#info").html(html)
		$("#info table tbody tr").on('click', function(e){
			let t = JSON.parse($(e.currentTarget).attr('bounds'))
			bigMap.fitBounds([[t._northEast.lat, t._northEast.lng], [t._southWest.lat, t._southWest.lng]])
		}).on('mouseenter', e => {
			geoArr[$(e.currentTarget).attr('textForPoint')].setStyle({
				fillOpacity:  gzSettings.opacity + .2,
				weight: gzSettings.border.weight + 1
			})
		}).on('mouseleave', e => {
			geoArr[$(e.currentTarget).attr('textForPoint')].setStyle({
				fillOpacity:  gzSettings.opacity,
				weight: gzSettings.border.weight
			})
		})
	}

	let drawTowers = function(data){
		let cellSettings = globalSettings.colors.points.towerCells; 
		let oneTowerSettings = globalSettings.colors.oneCell;
		let createText = function(obj){
			
			return Object.keys(obj).map((i) => "<b>"+i+":</b> "+obj[i]).join("<br>");
		}		
		console.log(data)
		let markersArr = data.map(cellGroup => {
			
			let text = createText({cellNum: cellGroup.cell_data.length})
			let cellType = (data => {
				let indoorN = data.filter(cell => cell.height <= 0).length
				if(indoorN == data.length)return "indoor"
				if(indoorN == 0)return "outdoor"
				return "mix"
			})(cellGroup.cell_data)
			let tMarker = L.circleMarker(cellGroup.coords,{params: {}, text:text, radius: cellSettings.point[cellType].radius,     weight: cellSettings.point[cellType].border.weight,  color: cellSettings.point[cellType].border.color, fillColor: cellSettings.point[cellType].background, fillOpacity: cellSettings.point[cellType].opacity}).bindTooltip(text, {className: 'myTooltip'})
			tMarker.on('click', function(e){
				console.log("click")
					let cellsHtml = "<scrollable><table class='cells points'><thead><tr><td>№</td><td>Cell</td><td>Lac</td><td>Azimut</td><td>Height</td></tr></thead><tbody>"+
						cellGroup.cell_data.map(cell => {
						if(cell.azimut == 360)cell.azimut = "<hexagon></hexagon>"
						return "<tr><td></td><td>"+ cell.cell +"</td><td>"+ cell.lac +"</td><td>"+ cell.azimut +"</td><td>"+ cell.height +"</td></tr>"
					}).join("")+"</tbody></table></scrollable>";
					$("#info").html(cellsHtml)
					$("#info table tbody tr").on('click', function(e){			
						$("#cellTowerCell").val($($(e.currentTarget).children()[1]).html())
						$("#cellTowerLac").val($($(e.currentTarget).children()[2]).html())
						$("#oneCellTower").click()
					});

					if(cellGroup.cell_data.length == 1){
						$("#cellTowerCell").val(cellGroup.cell_data[0].cell)
						$("#cellTowerLac").val(cellGroup.cell_data[0].lac)
						$("#oneCellTower").click()
					}
				});
			tMarker.on('mouseover', function(e){
				if(tMarker.options.azimuts && tMarker.options.azimuts.length)return;
				tMarker.options.azimuts = []
				for(var cell of cellGroup.cell_data.filter(el => el.azimut != 360)){
					let cellType = ((cell.height > 0)?"out":"in")+"door";	
					let t = L.polyline([cellGroup.coords, cell.coords_end], {color: oneTowerSettings[cellType].azimut.color, weight:oneTowerSettings[cellType].azimut.weight});
					tMarker.options.azimuts.push(t)
					t.addTo(layers.cellAzimuts).bringToBack()
				}
				//layers.cellAzimuts
				
			})
			tMarker.on('mouseout', function(e){
				if(!tMarker.options.azimuts)return
				for(let t of tMarker.options.azimuts){
					t.remove(bigMap)
					delete tMarker.options.azimuts
				}
			})
			return tMarker;
		})
		
		L.featureGroup(markersArr).addTo(layers.cells)
	}

	let drawUserPoints = function(data){
		let posMethods = [2, 4096, 8192]
		let color = globalSettings.colors.points.raw.point.backgrounds[posMethods[+$("#userPointsMethod").val() -1]]
		
		if(!data.length){
			console.error("Empty data :(");
			showError('Нет данных')
		}

		for(coords of data){
			L.circle(coords, {radius:1, color: color}).addTo(layers.userPoints)
		}
	}

	$("#"+type+">noData:visible").hide();	
	$('#msisdn.error').removeClass("error");
	$('#cellTowerLac.error').removeClass("error");
	$('#cellTowerCell.error').removeClass("error");
	
	let msisdn = document.getElementById('msisdn').value
	let fromTime = moment(document.getElementById('fromDate').value + ' ' + document.getElementById('fromTime').value+':00', 'DD.MM.YYYY HH:mm:ss').toISOString()
	let tillTime = moment(document.getElementById('tillDate').value + ' ' + document.getElementById('tillTime').value+':59', 'DD.MM.YYYY HH:mm:ss').toISOString()
	let oneCellTowerParams = {
		lac: parseInt(document.getElementById('cellTowerLac').value),
		cell: parseInt(document.getElementById('cellTowerCell').value)
	}
	if(type != "userPoints" && type != "cellTowers" && type != "oneCellTower" && (!msisdn || !new RegExp(/^\+?7\(*\d{3}\)*\d{7}$/).test(msisdn))){
		$('#msisdn').addClass("error");
		showError('Введите номер абонента')
		return;
	}

	
	
	if(type == "oneCellTower"){
		let emptyParams = Object.entries(oneCellTowerParams).filter(el => !el[1]).map(el => el[0])
		if (emptyParams.length){
			for(el of emptyParams){
				let upperEl = el.charAt(0).toUpperCase() + el.slice(1)
				
				$('#cellTower'+upperEl).addClass("error");
			}
			showError('Введите '+emptyParams.join(' и ')+ ' вышки')
			return;
		}
		//if(Object.entries(oneCellTowerParams))
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
		}else if(type == 'oneCellTower'){
			drawOneTower(data)
		}else if(type == 'userPoints'){
			drawUserPoints(data)
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
		let check = function(max){
			return bigMap.getBounds().getNorth() - bigMap.getBounds().getSouth() > max && 
				bigMap.getBounds().getEast() - bigMap.getBounds().getWest() > max
		}
		$("#cellTowers").prop( "disabled", check(globalSettings.maxMapSizeForCellTowers) );
		$("#cellTowers").prop( "title", (!check(globalSettings.maxMapSizeForCellTowers))? $("#cellTowers").attr("correctTitle"):$("#cellTowers").attr("wrongTitle"))

		$("#userPoints").prop( "disabled", check(globalSettings.maxMapSizeForUserPoints) );
		$("#userPoints").prop( "title", (!check(globalSettings.maxMapSizeForUserPoints))? $("#userPoints").attr("correctTitle"):$("#userPoints").attr("wrongTitle"))

	}
	bigMap = L.map('map', {
		center: [55.751244, 37.618423],
		zoom: 12,
		layers: [grayscale].concat(overlaysArr.map(el => layers[el[0]]))
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
	var overlays = {};

	for(tOverlay of overlaysArr){
		overlays[tOverlay[1]] = layers[tOverlay[0]]
	}
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