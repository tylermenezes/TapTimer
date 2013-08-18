if (!('taptimer' in window)) {
    window.taptimer = {shared:null, base:null};
}

window.taptimer.watcher = new (function(){
    var _this = this;
    var Event = function()
    {
        var _delegates = [];
        /**
         * Registers an event handler
         * @param  callable delegate Event handler to register
         */
        this.register = function(delegate)
        {
            _delegates.push(delegate);
        }

        /**
         * Removes an event handler
         * @param  callable delegate Event handler to remove
         */
        this.deregister = function(delegate)
        {
            for (var i in _delegates) {
                if (_delegates[i] == delegate) {
                    _delegates.splice(i, 1);
                }
            }
        }

        /**
         * Executes all the registered event handlers
         * @params          Paramaters to pass to the event handlers
         */
        this.apply = function()
        {
            for (var i in _delegates) {
                this.callUserFuncArray(_delegates[i], arguments);
            }
        }

        /**
         * Calls a fucntion, passing in an array of values as position-wise arguments
         * e.g. callUserFuncArray(lambda, [1, 2, 3, 'a', 'b', 'c']) calls lambda(1, 2, 3, 'a', 'b', 'c');
         * @param  callable delegate   Function to execute
         * @param  array    parameters Paramaters to pass to the function
         * @return mixed               Result of the function
         */
        this.callUserFuncArray = function (delegate, parameters) {
            var func;

            if (typeof delegate === 'string') {
                func = (typeof this[delegate] === 'function') ? this[delegate] : func = (new Function(null, 'return ' + delegate))();
            }
            else if (Object.prototype.toString.call(delegate) === '[object Array]') {
                func = (typeof delegate[0] == 'string') ? eval(delegate[0] + "['" + delegate[1] + "']") : func = delegate[0][delegate[1]];
            }
            else if (typeof delegate === 'function') {
                func = delegate;
            }

            if (typeof func !== 'function') {
                throw new Error(func + ' is not a valid function');
            }

            return (typeof delegate[0] === 'string') ? func.apply(eval(delegate[0]), parameters) : (typeof delegate[0] !== 'object') ? func.apply(null, parameters) : func.apply(delegate[0], parameters);
        }
    }

    var randomString = function (length) {
        var result, chars;
        result = "";
        chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
        while (length > 0) {
            result += chars.charAt(Math.min(Math.floor(Math.random() * chars.length)));
            length--;
        }
        return result;
    }

    var client_id = randomString(50);
    var endpoint = null;

    var perEventHandlers = {};
    this.incoming_data = new Event();

    this.event = function(name)
    {
        if (!(name in perEventHandlers)) {
            perEventHandlers[name] = new Event();
        }

        return perEventHandlers[name];
    }

    var handleRawIngomingData = function(data)
    {
        if (data.event in perEventHandlers) {
            perEventHandlers[data.event].apply(data);
        }
    }

    /**
     * Executed when data is recieved, dispatch the event handler and restarts a request
     * @param  {*}      data Data recieved
     */
    var dataRecieved = function(data)
    {
        if (typeof(data) !== 'undefined') {
            _this.incoming_data.apply(data);
        }

        setTimeout(startLongPollThread, 100);
    }

    /**
     * Starts a new long poll thread
     */
    var startLongPollThread = function()
    {
        jQuery.ajax({
            url: endpoint,
            success: dataRecieved,
            error: function(err,e)
            {
                setTimeout(startLongPollThread, 100);
            },
            data: {"client_id": client_id},
            cache: false,
            dataType: 'json'
        });
    }

    this.start = function()
    {
        if (taptimer.shared == null) {
            throw "Invalid private key!";
        }

        endpoint = 'http://' + taptimer.base + ':6378/watch/' + taptimer.shared;
        startLongPollThread();
        startLongPollThread();
        startLongPollThread();
    }

    this.track = function(event, data)
    {
        if (typeof(data) === 'undefined') {
            data = {};
        }

        jQuery.ajax({
            url: 'http://' + taptimer.base + ':6378/track/' + taptimer.shared + '/' + event,
            data: data,
            cache: false,
            dataType: 'json'
        });
    }

    this.constructor = function()
    {
        this.incoming_data.register(handleRawIngomingData);
    }
    this.constructor();
})();

(function(){
    window.taptimer.countdown = new (function()
    {
        var cdIntervalId = null;
        var onTick = function(){
            var minutes = $('#minutes').text();
            var seconds = $('#seconds').text();

            if (minutes == 0 && seconds == 1) {
                $('body').addClass('ended');
                return;
            }

            seconds--;

            if (seconds < 0) {
                seconds = 59;
                minutes--;
            }

            $('#minutes').text(minutes);
            if (seconds < 10) {
                $('#seconds').text('0' + seconds);
            } else {
                $('#seconds').text(seconds);
            }

            if (minutes == 0) {
                $('#digits').addClass('warning');
            } else {
                $('#digits').removeClass('warning');
            }
        };
        var length = 60;

        this.start = function()
        {
            if (cdIntervalId === null) {
                $('body').removeClass('ended');
                $('#digits').removeClass('warning');
                cdIntervalId = setInterval(onTick, 1000);
            }
        }

        this.pause = function()
        {
            clearInterval(cdIntervalId);
            cdIntervalId = null;
        }

        this.stop = function()
        {
            this.pause();
            var minutes = Math.floor(length / 60);
            var seconds = length % 60;

            $('#minutes').text(minutes);
            if (seconds < 10) {
                $('#seconds').text('0' + seconds);
            } else {
                $('#seconds').text(seconds);
            }
        }

        this.setlength = function(newlength)
        {
            length = newlength;
            this.stop();
        }

        this.stop();
    })();
})();

(function(){
    window.startClient = function()
    {
        taptimer.base = 'localhost';
        taptimer.shared = 'swsea';


        // Add some handlers
        taptimer.watcher.event('start').register(function(data)
        {
            window.taptimer.countdown.start();
        });

        taptimer.watcher.event('pause').register(function(data)
        {
            window.taptimer.countdown.pause();
        });

        taptimer.watcher.event('stop').register(function(data)
        {
            window.taptimer.countdown.stop();
        });

        taptimer.watcher.event('setlength').register(function(data)
        {
            window.taptimer.countdown.setlength(data.data.newlength[0]);
        });


        taptimer.watcher.start();
    };

    window.startController = function()
    {
        taptimer.base = prompt("Base?");
        taptimer.shared = prompt("Key?");

        window.taptimer.control = new (function()
        {
            this.start = function()
            {
                taptimer.watcher.track('start');
            }
            this.pause = function()
            {
                taptimer.watcher.track('pause');
            }
            this.stop = function()
            {
                taptimer.watcher.track('stop');
            }
            this.setlength = function(newlength)
            {
                taptimer.watcher.track('setlength', {newlength: newlength});
            }
        })();
    }
})();

$(document).ready(function(){
    $('#setlength').click(function(){
        taptimer.control.setlength($('#length').val());
    });
    $('#start').click(function(){
        taptimer.control.start();
    });
    $('#pause').click(function(){
        taptimer.control.pause();
    });
    $('#stop').click(function(){
        taptimer.control.stop();
    });
});