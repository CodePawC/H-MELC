type ElementConfig = {
    [key: string]: any;
};



type PrintElement = {
    apiName: string;
    parameter: ElementConfig;
};

class PrintElementFactory {
    static createElement(type: string, config: ElementConfig): PrintElement {
        switch (type) {
            case 'text':
                return this.createText(config);
            case 'qrCode':
                return this.createQrCode(config);
            case 'qrCodeWithLogo':
                return this.createQrCodeWithLogo(config);
            case 'barCode':
                return this.createBarCode(config);
            case 'line':
                return this.createLine(config);
            case 'graph':
                return this.createGraph(config);
            case 'image':
                return this.createImage(config);
            default:
                throw new Error('Unsupported element type');
        }
    }

    static createText(config: ElementConfig): PrintElement {
        return {
            apiName: 'DrawLableText',
            parameter: {
                ...config
            }
        };
    }

    static createQrCode(config: ElementConfig): PrintElement {
        return {
            apiName: 'DrawLableQrCode',
            parameter: {
                ...config
            }
        };
    }

    static createQrCodeWithLogo(config: ElementConfig): PrintElement {
        return {
            apiName: 'DrawLableQrCodeWithImage',
            parameter: {
                ...config
            }
        };
    }

    static createBarCode(config: ElementConfig): PrintElement {
        return {
            apiName: 'DrawLableBarCode',
            parameter: {
                ...config
            }
        };
    }

    static createLine(config: ElementConfig): PrintElement {
        return {
            apiName: 'DrawLableLine',
            parameter: config
        };
    }

    static createGraph(config: ElementConfig): PrintElement {
        return {
            apiName: 'DrawLableGraph',
            parameter: config
        };
    }

    static createImage(config: ElementConfig): PrintElement {
        return {
            apiName: 'DrawLableImage',
            parameter: config
        };
    }
}

export default PrintElementFactory;
