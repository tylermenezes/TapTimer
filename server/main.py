import tornado.ioloop
import tornado.web
import collections
import datetime
import hashlib
import json
import time
import email
import os

class AsyncCallbackMixin(object):
    listeners = collections.defaultdict(collections.defaultdict)
    def wait_for_message(self, id, callback):
        if not(id in AsyncCallbackMixin.listeners):
            AsyncCallbackMixin.listeners[id] = collections.defaultdict(list)

        AsyncCallbackMixin.listeners[id][self.client_id].append(callback)

    def send_message(self, id, message):
        for client in AsyncCallbackMixin.listeners[id].values():
            while True:
                try:
                    callback = client.pop()
                except:
                    # No one is listening here
                    break

                try:
                    callback(message)
                except:
                    # This connection was closed, continue to the next one
                    pass
                else:
                    break


class WnotifyMessageMixin(AsyncCallbackMixin):
    id_lookup = collections.defaultdict(str)

    def register_waiter(self, private_id, callback):
        #public_id = hashlib.sha256(private_id).hexdigest()
        public_id = private_id
        WnotifyMessageMixin.id_lookup[public_id] = private_id
        self.wait_for_message(private_id, callback)

    def send_event(self, public_id, event_name, data):
        if public_id in WnotifyMessageMixin.id_lookup:
            private_id = WnotifyMessageMixin.id_lookup[public_id]
            self.send_message(private_id, json.dumps({
                "account": private_id,
                "event": event_name,
                "time": int(time.time()),
                "data": data
            }))

class ListenerHandler(tornado.web.RequestHandler, WnotifyMessageMixin):
    @tornado.web.asynchronous
    def get(self, private_id):
        if 'client_id' in self.request.arguments:
            self.client_id = self.request.arguments['client_id'][0];
        else:
            if self.request.remote_ip == '127.0.0.1':
                self.client_id = self.request.headers.get("X-Real-Ip", None)
            else:
                self.client_id = self.request.remote_ip

        def callback(message):
            self.set_header('Content-type', 'application/json')
            self.set_header('Access-Control-Allow-Origin', '*')
            self.set_header('Cache-Control', 'no-cache')
            self.write(message)
            self.finish()

        self.register_waiter(private_id, callback)

class ClientHandler(tornado.web.RequestHandler, WnotifyMessageMixin):
    def get(self, public_id, event_type):
        self.set_header('Content-type', 'application/json')
        self.set_header('Access-Control-Allow-Origin', '*')
        self.set_header('Cache-Control', 'no-cache')
        self.send_event(public_id, event_type, self.request.arguments)
        self.write(json.dumps({
                "ok": True
            }))

application = tornado.web.Application([
    (r"/watch/(?P<private_id>.*)", ListenerHandler),
    (r"/track/(?P<public_id>.*)/(?P<event_type>.*)", ClientHandler)
])

if __name__ == "__main__":
    application.listen(6378)
    tornado.ioloop.IOLoop.instance().start()
