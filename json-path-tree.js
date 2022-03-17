/* JSONPath 0.8.0 - XPath for JSON
    *
    * Copyright (c) 2007 Stefan Goessner (goessner.net)
    * Licensed under the MIT (MIT-LICENSE.txt) licence.
    */
   function jsonPath(obj, expr, arg) {
    var P = {
       resultType: arg && arg.resultType || "VALUE",
       result: [],
       normalize: function(expr) {
          var subx = [];
          return expr.replace(/[\['](\??\(.*?\))[\]']/g, function($0,$1){return "[#"+(subx.push($1)-1)+"]";})
                     .replace(/'?\.'?|\['?/g, ";")
                     .replace(/;;;|;;/g, ";..;")
                     .replace(/;$|'?\]|'$/g, "")
                     .replace(/#([0-9]+)/g, function($0,$1){return subx[$1];});
       },
       asPath: function(path) {
          var x = path.split(";"), p = "$";
          for (var i=1,n=x.length; i<n; i++)
             p += /^[0-9*]+$/.test(x[i]) ? ("["+x[i]+"]") : ("['"+x[i]+"']");
          return p;
       },
       store: function(p, v) {
          if (p) P.result[P.result.length] = P.resultType == "PATH" ? P.asPath(p) : v;
          return !!p;
       },
       trace: function(expr, val, path) {
          if (expr) {
             var x = expr.split(";"), loc = x.shift();
             x = x.join(";");
             if (val && val.hasOwnProperty(loc))
                P.trace(x, val[loc], path + ";" + loc);
             else if (loc === "*")
                P.walk(loc, x, val, path, function(m,l,x,v,p) { P.trace(m+";"+x,v,p); });
             else if (loc === "..") {
                P.trace(x, val, path);
                P.walk(loc, x, val, path, function(m,l,x,v,p) { typeof v[m] === "object" && P.trace("..;"+x,v[m],p+";"+m); });
             }
             else if (/,/.test(loc)) { // [name1,name2,...]
                for (var s=loc.split(/'?,'?/),i=0,n=s.length; i<n; i++)
                   P.trace(s[i]+";"+x, val, path);
             }
             else if (/^\(.*?\)$/.test(loc)) // [(expr)]
                P.trace(P.eval(loc, val, path.substr(path.lastIndexOf(";")+1))+";"+x, val, path);
             else if (/^\?\(.*?\)$/.test(loc)) // [?(expr)]
                P.walk(loc, x, val, path, function(m,l,x,v,p) { if (P.eval(l.replace(/^\?\((.*?)\)$/,"$1"),v[m],m)) P.trace(m+";"+x,v,p); });
             else if (/^(-?[0-9]*):(-?[0-9]*):?([0-9]*)$/.test(loc)) // [start:end:step]  phyton slice syntax
                P.slice(loc, x, val, path);
          }
          else
             P.store(path, val);
       },
       walk: function(loc, expr, val, path, f) {
          if (val instanceof Array) {
             for (var i=0,n=val.length; i<n; i++)
                if (i in val)
                   f(i,loc,expr,val,path);
          }
          else if (typeof val === "object") {
             for (var m in val)
                if (val.hasOwnProperty(m))
                   f(m,loc,expr,val,path);
          }
       },
       slice: function(loc, expr, val, path) {
          if (val instanceof Array) {
             var len=val.length, start=0, end=len, step=1;
             loc.replace(/^(-?[0-9]*):(-?[0-9]*):?(-?[0-9]*)$/g, function($0,$1,$2,$3){start=parseInt($1||start);end=parseInt($2||end);step=parseInt($3||step);});
             start = (start < 0) ? Math.max(0,start+len) : Math.min(len,start);
             end   = (end < 0)   ? Math.max(0,end+len)   : Math.min(len,end);
             for (var i=start; i<end; i+=step)
                P.trace(i+";"+expr, val, path);
          }
       },
       eval: function(x, _v, _vname) {
          try { return $ && _v && eval(x.replace(/@/g, "_v")); }
          catch(e) { throw new SyntaxError("jsonPath: " + e.message + ": " + x.replace(/@/g, "_v").replace(/\^/g, "_a")); }
       }
    };
 
    var $ = obj;
    if (expr && obj && (P.resultType == "VALUE" || P.resultType == "PATH")) {
       P.trace(P.normalize(expr).replace(/^\$;/,""), obj, "$");
       return P.result.length ? P.result : false;
    }
 } 

/*********************************************************
 * checkChildren - recursive tree parser to decend into 
 * a JSON object and return a jsonPATH structure for use
 * in dynamic mapping activities.
 * 
 * By: Casey Riley
 * License - MIT
 * Date: 3/17/22
 */
function checkChildren( obj, nodeId, srch ) {
     
    var tc={
        name: "",
        path: "",
        type: "",
        value: ""
    };

    var children = jsonPath(obj,srch+".*", {resultType:"PATH"} );

    var el = getElement(obj, srch);
    tc.name= (el.name == "") ? "root" : el.name;
    tc.path = srch;
    tc.type = el.type;
    tc.value = el.value;
    
    for (const child in children) {
        if (typeof tc._children == "undefined") tc["_children"]=[];
        tc._children.push(checkChildren(obj, nodeId, children[child]));    
    }
    return tc;
}


/********************************************************
 * getElement - uses jsonPATH notation created to work 
 * with checkChildren.  
 * 
 * It returns part of the JSON tree structure that is 
 * the decent is working with 
 * 
 */
function getElement(obj,path) {
      var checkObj = jsonPath(obj,path+".*" );
      var sTemp=path.replace(/[^0-9a-zA-Z]+/g, "-");
           sTemp=sTemp.substr(1,sTemp.length-1);
           sTemp=sTemp.substr(0,sTemp.length-1);
      
      var nodeName=sTemp.split(/\-/g);

      if (checkObj instanceof Array) {
          // find variable name
         if (checkObj.length > 1){
              return  { name: nodeName[nodeName.length-1], type: "(Array)", value: jsonPath(obj,path) };
          } 
          return { name: nodeName[nodeName.length-1], type: "(Object)", value: jsonPath(obj,path) };
      } 
      if (checkObj === false) {
        
          return { name: nodeName[nodeName.length-1], type: "(Property)", value: jsonPath(obj,path) };
           
      }

      return null;
 }