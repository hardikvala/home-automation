/*** HTTPDevice Z-Way HA module *******************************************

Version: 1.0.0
(c) Z-Wave.Me, 2014
-----------------------------------------------------------------------------
Author: Poltorak Serguei <ps@z-wave.me>
Description:
    Implements virtual device based on HTTP object
******************************************************************************/

// ----------------------------------------------------------------------------
// --- Class definition, inheritance and setup
// ----------------------------------------------------------------------------

function HTTPDevice (id, controller) {
    // Call superconstructor first (AutomationModule)
    HTTPDevice.super_.call(this, id, controller);
}

inherits(HTTPDevice, AutomationModule);

_module = HTTPDevice;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

HTTPDevice.prototype.init = function (config) {
    HTTPDevice.super_.prototype.init.call(this, config);

    var self = this,
        icon = "",
        deviceType = this.config.deviceType;
        
    switch(deviceType) {
        case "sensorBinary":
        case "sensorMultilevel":
            icon = "sensor";
            break;
        case "switchBinary":
            icon = "switch";
            break;
        case "switchMultilevel":
            icon = "multilevel";
            break;
        case "toggleButton":
            icon = "";
            break;
    }
    
    var defaults = {
        deviceType: deviceType,
        metrics: {
            // level is not here to load last data and then get update from HTTP
            icon: icon,
            title: 'HTTP device ' + this.id
        }
    };
    
    if (deviceType === "sensorMultilevel") {
        defaults.metrics.scaleTitle = this.config.scale_sensorMultilevel || "";
    }
    if (deviceType === "sensorBinary") {
        defaults.metrics.scaleTitle = "";
    }

    var vDev = self.controller.devices.create("HTTP_Device_" + deviceType + "_" + this.id, defaults, function(command, args) {
        var vDevType = deviceType;
        
        if (command === "update" && (vDevType === "sensorBinary" || vDevType === "sensorMultilevel" || vDevType === "switchBinary" || vDevType === "switchMultilevel")) {
            self.update(this);
        }
        
        if (command === "on" && (vDevType === "toggleButton" || vDevType === "switchBinary")) {
            self.act(this, "On", null, (vDevType === "switchBinary" ? "on" : null));
        }


        if (command === "off" && vDevType === "switchBinary") {
            self.act(this, "Off", null, "off");
        }

        if ((command === "off" || command === "on" || command === "exact") && vDevType === "switchMultilevel") {
        	var level = command === "exact" ? parseInt(args.level, 10) : (command === "on" ? 99 : 0);
            self.act(this, "Level", level, level);
        }
    });
    
    if (vDev && this.config["getter_" + deviceType] && this.config["getterPollInterval_" + deviceType]) {
        this.timer = setInterval(function() {
            self.update(vDev);
        }, this.config["getterPollInterval_" + deviceType] * 1000);
    }
};

HTTPDevice.prototype.stop = function () {
    if (this.timer) {
        clearInterval(this.timer);
    }
    
    this.controller.devices.remove("HTTP_Device_" + this.config.deviceType + "_" + this.id);
    
    HTTPDevice.super_.prototype.stop.call(this);
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

HTTPDevice.prototype.update = function (vDev) {
	var self = this,
        deviceType = vDev.get("deviceType"),
        url = this.config["getter_" + deviceType],
        parser = this.config["getterParser_" + deviceType];
    
    if (!parser && (deviceType == "sensorMultilevel" || deviceType == "switchMultilevel")) {
        parser = "parseInt(%%)";
    }
    
    if (url) {
        http.request({
            url: url,
            method: this.config.method,
            async: true,
            success: function(response) {
            	var data = typeof(response.data) == "object" ? "(" + JSON.stringify(response.data) + ")": response.data.toString();
                vDev.set("metrics:level", parser ? eval(parser.replace(/%%/g, data)) : response.data);
            },
            error: function(response) {
                console.log("Can not make request: " + response.statusText); // don't add it to notifications, since it will fill all the notifcations on error
            } 
        });
    }
};

HTTPDevice.prototype.act = function (vDev, action, subst, selfValue) {
    var self = this,
        deviceType = vDev.get("deviceType"),
        url = this.config["setter" + action + "_" + deviceType];
    
    if (url) {
    	if (subst) {
    		url = url.replace(/%%/g, subst);
    	}
        http.request({
            url: url,
            method: this.config.method,
            async: true,
            error: function(response) {
                self.controller.addNotification("error", "Can not make request: " + response.statusText, "module");
            }
        });
    } else if (selfValue !== null) {
        vDev.set("metrics:level", selfValue);
    }
};