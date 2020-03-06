const http = require('http')
const querystring = require('querystring')
const express = require('express');
const app = module.exports = express();
const { Pool } = require('pg');
const async = require('async');
const request = require('request');
const conf = require('./config.json');
const confDB = require('./'+ conf.env +'Conf.json')

app.set('port', conf.appPort);

let initPool = function(data){
	let poolConnetorParams = {
		max:20,
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 10000,
	}
	return new Pool(Object.assign(data, poolConnetorParams))
}


let connectors = {
	mtsPoisk:  initPool(confDB.mtsPoisk),
	cells: initPool(confDB.cells),
	area: [
		initPool(confDB.area0),
		initPool(confDB.area1),
	]
}

let endWithError = function(res, status, errorText){
  if(errorText)res.set("X-Error", errorText)
  res.sendStatus(status)
}

let checkMsisdn =  function (req, res, next) {
	if (!req.query.msisdn){
		endWithError(res, 400, "Empty msisdn")
    	return;
	}
    let test = new RegExp(/^\+?(7\(*\d{3}\)*\d{7})$/);
    if (!test.test(req.query.msisdn.trim())){
    	endWithError(res, 400, "Wrong msisdn")
    	return;
    }else next()
};


app.get('/favicon.ico', (req, res) => res.status(204));

app.get('/geo', checkMsisdn, function(req, res){ 
	console.log("geo query with params",req.query)
    let msisdn = req.query.msisdn;

    connectors.mtsPoisk.query("select get_user_zone from poi.get_user_zone("+msisdn+");", (err, data) => {
	    if(err){
            console.error("!!!!!!!!!", err)
            endWithError(res, 500, "DB error ("+err+")");
            return;
        }
        console.log("OK")
	    res.json(data.rows[0].get_user_zone);
	})    
}); 


app.get('/area', function(req, res, next){
	console.log("area query with params",req.query)

	if(conf.env == 'preProd'){
		endWithError(res, 501, "No data in prod DB")
		return
	}

	if(!req.query.lata || !req.query.latb || !req.query.lona || !req.query.lonb){
		endWithError(res, 400, "Missing coords");
    	return;
	}

	if(!req.query.startTime || !req.query.endTime){
		endWithError(res, 400, "Missing time period");
    	return;
	}

	if(!req.query.method){
		endWithError(res, 400, "Missing method");
    	return;
	}

	next()
}, function(req, res){
	
	let query = "select f_get_all_points from main.f_get_all_points("+req.query.lata+","+req.query.lona+","+req.query.latb+","+req.query.lonb+",'"+req.query.startTime+"','"+req.query.endTime+"',"+req.query.method+");"

	async.parallel([
		function(cb){
			connectors.area[0].query(query, cb)
		},
		function(cb){
			connectors.area[1].query(query, cb)
		}		
	], function(err, results){
		if(err){
			console.error("!! Error:", err);
			endWithError(res, 500, "DB error");
			return;
		}
		console.log("OK")
		res.json(results[0].rows[0].f_get_all_points.concat(results[1].rows[0].f_get_all_points));
	})
})

app.get('/coords', [checkMsisdn,function(req, res, next){
	console.log("coords query with params",req.query)
	if (!req.query.type){
		endWithError(res, 400, "Missing type");
    	return;
	}
	if (!["raw", "processed", "last", "live"].includes(req.query.type)){
		endWithError(res, 400, "Wrong type");
    	return;
	}

	if (req.query.type != "live" && (!req.query.startTime || !req.query.endTime)){
		endWithError(res, 400, "Missing time period");
    	return;
	}
	next()

}], function(req, res){

	let type = req.query.type;
	let queryBody = {
		sender: "gdv_sender",
		profile :"poisk",
		subscriberId :"msisdn+"+req.query.msisdn.trim(),
		priority: 3,
		hideTimes: [],
		sources: ["locations"],
		inputs: [12561, 16384],
		infolevel: 1,
		lang: "ru"
	}
	let url = confDB.postUrl;
	switch(type){
		case "live":
			url += "/opervals?action=getOnce"
			queryBody.age = 180;
			break;
		case "processed":
			url += "/histvals";
			queryBody.inputs = [13001,16384];
			break;
		case "raw":
			url += "/histvals";
			break;
		case "last":
			url +="/opervals?action=getLast"
			queryBody.limit = 2;
			break;
	}
	if (type != "live"){
		queryBody.startTime = req.query.startTime;
		queryBody.endTime = req.query.endTime;
	}

	console.log("trying to make request to "+url+" with payload", queryBody)

	request({
		uri: url,
		method: 'POST',
		json: queryBody,
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Basic bGR0ZHB1c2VyMTp7QTMlcn1zb342dmI=',
			'User-Agent': 'GDV_server_0.1',
			Accept: '*/*',
			Connection: 'keep-alive',
		}
	}, function (err, result, body) {
	    if (err){
			console.error("! Error:", err);
			endWithError(res, 500, "POST error");
			return;
		}
		if (result.statusCode != 200){
			console.error("!! Error:", result.statusCode, result.statusMessage);
			endWithError(res, 500, "Error from remote server "+result.statusCode+" "+result.statusMessage);
			return;
		}
		
		if (type == "live"){
			result.body.inputValues = [{inputs: result.body.inputs}]
		}
		console.log("OK")
		res.json(result.body.inputValues.reverse())
	})

})

app.get('/cells', function(req, res, next){
	console.log("cells query with params",req.query)
	if(!req.query.lata || !req.query.latb || !req.query.lona || !req.query.lonb){
		endWithError(res, 400, "Missing coords")
    	return;
	}
	next();
}, function(req, res){	
	if(conf.env == 'prod'){
		endWithError(res, 501, "No data in prod DB")
		return
	}

	connectors.cells.query("select f_get_sell_group from cell.f_get_sell_group("+req.query.lata+","+req.query.lona+","+req.query.latb+","+req.query.lonb+");", (err, data) => {
	    if(err){
            console.error("DB error:", err)
            endWithError(res, 500, "DB error");
            return;
        }
        console.log("OK")
	    res.json(data.rows[0].f_get_sell_group);
	}) 
})

app.get('/poly', function(req, res, next){
	console.log("poly query with params",req.query)
	if(!req.query.lac || !req.query.cell){
		endWithError(res, 400, "Missing params")
    	return;
	}
	next();
}, function(req, res){	
	if(conf.env == 'prod'){
		endWithError(res, 501, "No data on prod DB")
		return
	}

	connectors.cells.query("select v_geo_js from cell.f_get_sell_info("+req.query.cell+" ,"+req.query.lac+");", (err, data) => {
	    if(err){
            console.error("DB error:", err)
            endWithError(res, 500, "DB error");
            return;
        }
        console.log("OK")
	    res.json(data.rows[0].v_geo_js);
	}) 
})

app.get("/params", (req, res) => {
	const serverParams = {
		appName: (conf.appName)?conf.appName:undefined,
		appVersion: (conf.appVersion)?conf.appVersion:undefined,
		config: conf.env
	}
	res.json(serverParams);
})

app.get('*', function(req, res){
	endWithError(res, 404);
});

http.createServer(app).listen(app.get('port'), function () {
  console.log('Server listening on port ' + app.get('port'));
});
