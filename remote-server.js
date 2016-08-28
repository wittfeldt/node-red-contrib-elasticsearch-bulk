module.exports = function(RED) {
    function RemoteServerNode(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host;
        this.port = n.port;
    }
    
    RemoteServerNode.prototype.fmt = function(num, digits) {
      if (typeof digits === 'undefined') digits = 1;
      var units = ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'],
      decimal;

      for(var i=units.length-1; i>=0; i--) {
        decimal = Math.pow(1000, i+1);
        if(num <= -decimal || num >= decimal) {
          return +(num / decimal).toFixed(digits) + units[i];
        }
      }
      return num;
    }
    
    RED.nodes.registerType("remote-server", RemoteServerNode);
}
