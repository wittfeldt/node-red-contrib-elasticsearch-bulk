module.exports = function(RED) {

  var elasticsearch = require('elasticsearch');

  function Bulk(config) {
    RED.nodes.createNode(this,config);
    this.server = RED.nodes.getNode(config.server);
    var node = this;
    
    var client = new elasticsearch.Client({
      host: this.server.host + ":" + this.server.port,
      maxRetries: 3,
      requestTimeout: 30000,
      suggestCompression: true
    });
    
    var tickMs = 500,
    idleTimeout = 3000,
    buf = [],
    bufSize = 0,
    idleMs = 0,
    processedItems = 0,
    failedItems = 0,
    isProcessing = false,
    tickTimer = setInterval(onTick, tickMs);
      
    /*
    action: {
    index: {
    _index: "someindex",
    _type: "sometype"
    _id: 42
    }
    },
    payload: {
    aString: "abc123",
    aNumber: 499
    }
    */
    
    node.on('input', function(msg) {
      idleMs = 0;
      try {
        buf.push(prepare(msg));
        bufSize+=1;
      } catch(err) {
        node.warn("Dropping invalid message: " + err.message);
        failedItems+=1;
      }
    });
    
    function onTick() {
      idleMs+=tickMs;
      if (bufSize >= config.maxBulkSize || (bufSize > 0 && idleMs > idleTimeout)) {
        processBuffer();
      }
    }
    
    function processBuffer() {
      if (isProcessing) {
        return;
      } else {
        isProcessing = true;
      }
      var chunk = buf.splice(0, config.maxBulkSize);
      bufSize-=chunk.length;
      setNodeStatus();
      processChunk(chunk);
    }
  
    function processChunk(chunk) {
      var opts = {
        body: chunk.reduce(function(memo, item) {
          memo.push(item.action);
          memo.push(item.payload);
          return memo;
        }, [])
      }
      client.bulk(opts, function(err, res) {
        if (err) {
          node.warn("Chunk discarded: " + err.message);
          node.send({ payload: err });
          failedItems+=chunk.length;
        } else {
          if (res.errors) {
            handleError(res.errors);
          } else {
            processedItems+=chunk.length;
          }
          if (res.items) {
            res.count = res.items.length;
            delete res.items;
          }
          node.send({ payload: res });
        }
        isProcessing = false;
        setNodeStatus();
      })
    }
  
    function setNodeStatus() {
      var fmt = node.server.fmt;
      var text = fmt(bufSize) + " " 
      + fmt(processedItems) + " " + fmt(failedItems);
      node.status({
        fill: failedItems > 0 ? "yellow" : "green",
        shape: isProcessing ? "ring" : "dot",
        text: text
      });
    }
  
    function handleErrors(arr) {
      arr.items.forEach(function(item) {
        var k = Object.keys(item)[0];
        if (item[k].error) {
          node.warn(JSON.stringify(item[k].error));
          failedItems+=1;
        } else {
          processedItems+=1;
        }
      })
    }

    function prepare(msg) {
      if (!msg.action) throw new Error("msg.action is required");  
      var action = Object.keys(msg.action)[0];
      var meta = msg.action[action] || {};
      meta._index = meta._index || config.documentIndex;
      meta._type = meta._type || config.documentType;
      if (!meta._index) throw new Error("_index is required");
      if (!meta._type)  throw new Error("_type is required");
      return msg;
    }
  }
  RED.nodes.registerType("bulk", Bulk);
}
