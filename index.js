const path = require('path');
const fs = require('fs');

const NexRequest = require('./nex-request');
const NexFs = require('./nex-fs');
const NexSleeper = require('./nex-sleeper');

//Helpers
class NexDownloader {
    constructor(basicOptions) {
        this.download = this.download.bind(this);

        if (!basicOptions) basicOptions = {};
        if (!basicOptions.retryRequestOptions) basicOptions.retryRequestOptions = {};
        this.nexRequest = new NexRequest(basicOptions.retryRequestOptions);
        this.timeout = basicOptions.timeout;
        this.logger = basicOptions.logger;
    }


    async download(url, downloadOptions) {
        if (!url) throw new Error('url is missing.');
        if (!downloadOptions) downloadOptions = {};

        if (this.logger) this.logger('Download task:' + JSON.stringify({url, downloadOptions}));

        let skipIfExist = downloadOptions.skipIfExist || false; //default: false (will be a forced false if job is being retried)
        let checkSizeBeforeSkip = downloadOptions.checkSizeBeforeSkip || false; //default: false
        let minimumTime = downloadOptions.minimumTime || 0;

        let folder = downloadOptions.targetFolder || __dirname;
        let filename = downloadOptions.filename || getFilenameFromUrl(url); //if filename is not provided, will guess from url. If url is ended with a slash, error is reported.
        let localFile = path.join(folder, filename);
        if (this.logger) this.logger(`${filename}: Local target: ${localFile}`);


        let sleeper = new NexSleeper(minimumTime);
        NexFs.prepareDirectory(localFile);


        //1, check if file exist
        let needDownload = true; //By default, we shall download.
        if (skipIfExist && fs.existsSync(localFile)) {
            if (this.logger) this.logger(`${filename}: Local file exist.`);
            needDownload = false; //Probably download is not needed, unless...
            if (checkSizeBeforeSkip) {
                if (this.logger) this.logger(`${filename}: Checking size consistency...`);
                let localSize = NexFs.getLocalFileSize(localFile);
                let remoteSize = await this.getRemoteSize(url);
                if (localSize !== remoteSize) {
                    needDownload = true; //Still need download
                    if (this.logger) this.logger(`${filename}: Size inconsistent, redownload required: local:${localSize}, remote:${remoteSize}`);
                } else {
                    if (this.logger) this.logger(`${filename}: Size consistency check passed, download not required.`);
                }
            }
        }

        if (needDownload) {
            if (this.logger) this.logger(`${filename}: Attempting download...`);
            for (let i = 0; i < 2; i++) {
                try {
                    await this.fetchAndWrite(url, localFile);
                    break;
                } catch (err) {
                    if (this.logger) this.logger(`${filename}: ${err.toString()}` );
                }

            }
            await sleeper.wait();
        }

        if (this.logger) this.logger(`${filename}: Download session closed successfully.`);
        return localFile;

    }


    async fetchAndWrite(remoteUrl, localFile) {
        //Download, write, and return bytes written.

        const fs = require('fs');
        let responseObject = await this.nexRequest.responseObject({
            url: remoteUrl,
            encoding: null,
            timeout: this.timeout
        });
        let declaredLength = Number(responseObject.headers['content-length']);
        let receivedLength = responseObject.body.length;
        if (declaredLength && declaredLength !== receivedLength) {
            throw new Error('content-length in header not equal to received length');
        }

        fs.writeFileSync(localFile, responseObject.body);
        return receivedLength;
    }


    async getRemoteSize(remoteUrl) {
        let obj = await this.nexRequest.responseObject({
            url: remoteUrl,
            method: 'head',
            timeout: this.timeout
        });
        return Number(obj.headers['content-length']);
    }

}

function getFilenameFromUrl(url) {
    url = new URL(url);
    let answer = url.pathname.toString().split('/').pop();
    if (answer === '') throw new Error('Cannot determine filename from url:' + url);
    return answer;
}

module.exports = NexDownloader;
