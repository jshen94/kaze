import _ = require('lodash');
import ActionReducers = require('./actions-reducers');
import MapFile = require('../kaze/map-file');

// Error messages for map editor
const sanityCheck = (parsedJson: any): void => {
    const mapContent = parsedJson.mapContent;
    if (mapContent.name === undefined || !_.isString(mapContent.name)) throw 'Map has no name';
    if (mapContent.blockWidth === undefined || !_.isNumber(mapContent.blockWidth) || mapContent.blockWidth <= 0) throw 'Invalid map width';
    if (mapContent.blockHeight === undefined || !_.isNumber(mapContent.blockHeight) || mapContent.blockHeight <= 0) throw 'Invalid map height';
    if (!_.isArray(parsedJson.spriteFileNames) || !_.isString(parsedJson.spriteFileNames[0])) throw 'Invalid sprite files';
    if (!_.isNumber(mapContent.rows[0][0])) throw 'Invalid sprite reference';
    if (!_.isNumber(mapContent.barrierRows[0][0])) throw 'Invalid barrier data';
    if (mapContent.rows.length !== mapContent.blockHeight) throw 'Broken map height';
    if (mapContent.rows[0].length !== mapContent.blockWidth) throw 'Broken map width';
};

export const mapStringify = (mapContent: MapFile.MapContent, fileNameToUrl: Map<string, string>): string => {
    // ES6 map retains insertion order
    return JSON.stringify(new MapFile.MapFile(mapContent, Array.from(fileNameToUrl.keys())));
};

export const makeFileName = (mapName: string): string => {
    return mapName.toLowerCase().replace(/(\ )|[^a-z0-9]/g, '-') + '.json';
};

export interface ReadMapFile {
    mapContent: MapFile.MapContent;
    fileNameToUrl: Map<string, string>;
}

const makeImageFileUrls = (files: FileList): Map<string, string> => {
    const imageFileToUrl = new Map<string, string>(); // File name -> imageFile element sourceable URL
    for (let i = 0; i < files.length; ++i) {
        if (_.endsWith(files[i].name, '.jpg') ||
            _.endsWith(files[i].name, '.jpeg') ||
            _.endsWith(files[i].name, '.png')) { 
            imageFileToUrl.set(files[i].name, URL.createObjectURL(files[i]));
        }
    }
    return imageFileToUrl;
};

// Specific to client side
// Want to read map data, making sure all referenced images are included in the file list,
// and then mapping each image to a URL so it can be drawn
// Throws all map validation errors as strings
export const readMapFile = (
    files: FileList,
    errorCallback: (e: string) => void,
    callback: (result: ReadMapFile) => void
): void => {
    const imageFileToUrl = makeImageFileUrls(files);

    // Expect only one JSON file inside *files*
    let jsonFileIndex = -1;
    for (let i = 0; i < files.length; ++i) {
        if (jsonFileIndex !== -1) {
            errorCallback('Multiple JSON files found, which is the map?');
            return;
        } else if (_.endsWith(files[i].name, '.json')) {
            jsonFileIndex = i;
        }
    }
    if (jsonFileIndex === -1) {
        errorCallback('No JSON map file found');
        return;
    }

    const reader = new FileReader;
    reader.readAsText(files[jsonFileIndex]);
    reader.onload = (e: Event): void => {
        const parsed: any = JSON.parse(reader.result);
        sanityCheck(parsed);  
        const fileNameToUrl = new Map<string, string>();
        // Want to map spriteFileNames to URLs
        // ES6 map retains insertion order so create copy of imageFileToUrl with map file sprite order
        for (const fileName_ of parsed.spriteFileNames) {
            const fileName = fileName_ as string;
            const url = imageFileToUrl.get(fileName);
            if (url === undefined) {
                errorCallback(`Referenced image ${fileName} not found`);
                return;
            }
            fileNameToUrl.set(fileName, url);
        }
        const mapContent = parsed.mapContent as MapFile.MapContent;
        callback({mapContent, fileNameToUrl});
    };
};

export const clone2dArray = <T>(array: T[][]): T[][] => {
    return array.map((row) => row.slice());
};

export const download = (json: string, fileName: string): void => {
    const blob = new Blob([json]);
    const url = URL.createObjectURL(blob);
    const $link = $('<a />');
    const linkElement = $link[0] as HTMLAnchorElement;
    linkElement.href = url;
    linkElement.download = fileName;
    $(document.body).append($link);
    linkElement.click();
    setTimeout(() => {
        $link.remove();
        URL.revokeObjectURL(url);  
    }); 
};
