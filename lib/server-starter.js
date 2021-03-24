const { EventEmitter } = require('events')
const net = require('net')
const { spawn } = require('child_process')

class ServerStarter {
  newServer (port, address) {
    const server = new Server(port, address)
    return server.listen().then(() => server)
  }
}

class Server extends EventEmitter {
  constructor (port, address) {
    super()
    this._originalPort = port || 0
    this._originalAddress = address
    this.port = undefined
    this._handle = undefined
    this._fd = undefined
    this._srv = undefined
    this._process = undefined
    this._exitHandlers = []
    this._exit = undefined
  }

  close (signal = 'SIGINT') {
    this._process.kill(signal)
    if (typeof this._exit !== 'undefined') return Promise.resolve
    return new Promise((resolve) => this._exitHandlers.push(resolve))
  }

  launch (cmd, args, options = {}) {
    if (typeof this._process !== 'undefined') throw new Error('Server already launched')
    const stdout = typeof options.stdout !== 'undefined' ? options.stdout : false
    const stderr = typeof options.stderr !== 'undefined' ? options.stderr : true

    const proc = (this._process = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe', this._fd] }))
    this._srv.close()
    proc.stdout.on('data', (data) => {
      if (stdout) process.stdout.write(data.toString('utf8'))
      this.emit('stdout', data)
    })
    proc.stderr.on('data', (data) => {
      if (stderr) process.stderr.write(data.toString('utf8'))
      this.emit('stderr', data)
    })
    proc.on('exit', (code, signal) => {
      this._exit = true
      this._exitHandlers.forEach(item => item())
      this.emit('exit', code, signal)
    })

    return Promise.resolve()
  }

  listen () {
    return new Promise((resolve) => {
      const srv = net.createServer()
      srv.listen(this._originalPort, this._originalAddress, () => {
        this._srv = srv
        this.port = srv.address().port
        this._handle = srv._handle
        this._fd = this._handle.fd
        resolve()
      })
    })
  }

  url () {
    const address = this._originalAddress || '127.0.0.1'
    const port = this.port
    return `http://${address}:${port}`
  }
}

exports = module.exports = new ServerStarter()
exports.starter = exports