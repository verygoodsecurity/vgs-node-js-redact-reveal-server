const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const request = require('axios');
const tunnel = require('tunnel');
require('dotenv').config();
const app = express();
const port = 3000

const VGS_INBOUND_PROXY = process.env.VGS_INBOUND_PROXY;
const VGS_OUTBOUND_PROXY = process.env.VGS_OUTBOUND_PROXY;
const SERVER_UPSTREAM_HOST = process.env.SERVER_UPSTREAM_HOST;
const VGS_PROXY_AUTH = process.env.VGS_PROXY_AUTH;
const REDACT_PAYLOAD = process.env.REDACT_PAYLOAD;


var cors = (function(req,res,next){
    if (req.method === "OPTIONS") {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
      } else {
        res.header('Access-Control-Allow-Origin', '*');
      }
    next();
});
app.use(cors);
app.use(bodyParser.json());

app.get('/start', (req,res) => {

  async function redactAndReveal() {

    // Redact the payload INBOUND
    let redacted_payload = await request.post(
      VGS_INBOUND_PROXY,
      JSON.stringify({'test' : REDACT_PAYLOAD}),
      {
        headers: {
          'Content-Type':'application/json'
        }
      }
    ).then((response) => {
      console.log('\nResponse from Axios request on REDACT:');
      console.log(response.data);
      return JSON.parse(response.data.data).test;
    });


    // Proxy through VGS and REVEAL payload
    const tunnelingAgent = tunnel.httpsOverHttp({
      ca: [ fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS)],
      proxy: {
          host: VGS_OUTBOUND_PROXY,
          port: 8080,
          proxyAuth: VGS_PROXY_AUTH
      }
    });

    let revealed_payload = await request.post(
      SERVER_UPSTREAM_HOST,
      JSON.stringify({'test' : redacted_payload}),
      {
        httpsAgent: tunnelingAgent,
        proxy: false,
        headers: {
          'Content-Type':'application/json'
        }
    }).then((r) => {
      console.log('\nResponse from Axios request on REVEAL:');
      console.log(r.data);
      return r.data;
    });

    res.send(JSON.stringify(revealed_payload));
  }

  redactAndReveal();
});

// Endpoint to POST to your server to see the payload echoed back
app.post('/reveal', (req,res) => {
  res.send(req.body);
});

app.listen(port, () => {
  console.log(`Node server listening on port ${port}`);
});
