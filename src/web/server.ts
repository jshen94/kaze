import express = require('express')
import path = require('path');

const app = express()
const distFolder = path.join(__dirname, '../../dist');
app.use(express.static(distFolder));

app.listen(8080, function () {
  console.log('listening')
})
