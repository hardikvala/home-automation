define([
    //libs
    'backbone',
    'models/device'
], function (Backbone, DeviceM) {
    'use strict';
    var DevicesCollection =  Backbone.Collection.extend({
        // model reference
        model: DeviceM,
        activeMode: false,
        methodToURL: {
            'read': '/devices',
            'create': '/devices',
            'update': '/devices',
            'delete': '/devices'
        },

        url: function () {
            var url = this.id !== undefined ? '/' + this.id : '';
            return url;
        },

        sync: function (method, model, options) {
            options = options || {};
            options.data = options.data || {};
            options.url = model.methodToURL[method.toLowerCase()] + this.url();

            if (this.updateTime !== undefined && !this.structureChanged) {
                options.data.since = this.updateTime;
            }

            Backbone.sync(method, model, options);
        },

        parse: function (response, xhr) {
            var that = this,
                devicesId = window.App.Profiles.getActive().get('positions') || [],
                zipped = [];

            if (response.data.structureChanged) {
                var removalList = [];
                _.each(that.models, function (model) {
                    if (!_.any(response.data.devices, function (dev) { return model.id === dev.id; })) {
                        removalList.push(model);
                    }
                });

                _.each(removalList, function(model) {
                    log('Remove model ' + model.id);
                    that.remove(model);
                });
            }

            if (!Boolean(that.updateTime)) {
                // push only show
                _.each(devicesId, function (deviceId) {
                    if (_.any(response.data.devices, function (device) { return device.id === deviceId; })) {
                        zipped.push(_.find(response.data.devices, function (device) { return device.id === deviceId; }));
                    }
                });

                // push other
                zipped = _.union(zipped, _.filter(response.data.devices, function (device) {
                    return devicesId.indexOf(device.id) === -1;
                }));
            } else {
                zipped = response.data.devices;
            }

            that.updateTime = response.data.updateTime;
            return zipped;
        },

        initialize: function () {
            _.bindAll(this, 'parse');
           log('init devices');
        }

    });

    return DevicesCollection;

});
