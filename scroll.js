module.exports = function(RED) {

  var elasticsearch = require('elasticsearch');

  function Scroll(config) {
    RED.nodes.createNode(this,config);
    this.server = RED.nodes.getNode(config.server);
    var node = this;
    
    var client = new elasticsearch.Client({
      host: this.server.host + ":" + this.server.port,
      maxRetries: 3,
      requestTimeout: 30000,
      suggestCompression: true
    });
    
    node.on('input', function(msg) {
      var pl = msg.payload,
      remaining = null,
      opts = {
        index: pl._index || config.documentIndex,
        scroll: config.scrollSec + "s",
        search_type: 'scan',
        query: pl.query,
        size: config.pageSize
      }
      client.search(opts, function next(err, res) {
        remaining = remaining || res.hits.total;
        remaining-=res.hits.hits.length;
        
        res.hits.hits.forEach(function(hit) {
          node.send({ payload: hit });
        })
        setNodeStatus(remaining)
        
        if (remaining > 0) {
          client.scroll({
            scrollId: res._scroll_id,
            scroll: '30s'
          }, next);
        }
      });
    });
    
    function setNodeStatus(count) {
      if (count > 0) {
        node.status({
          fill: "green",
          shape: (count > 0) ? "ring" : "dot",
          text: node.server.fmt(count)
        });
      } else {
        node.status({});
      }
    }
  }
  
  RED.nodes.registerType("scroll", Scroll);
}
