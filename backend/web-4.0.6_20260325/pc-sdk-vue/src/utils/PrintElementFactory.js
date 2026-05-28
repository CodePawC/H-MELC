class PrintElementFactory {
  static createElement(type, config) {
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

  static createText(config) {
    return {
      apiName: 'DrawLableText',
      parameter: {
        ...config
      }
    };
  }

  static createQrCode(config) {
    return {
      apiName: 'DrawLableQrCode',
      parameter: {
        ...config
      }
    };
  }

  static createQrCodeWithLogo(config) {
    return {
      apiName: 'DrawLableQrCodeWithImage',
      parameter: {
        ...config
      }
    };
  }

  static createBarCode(config) {
    return {
      apiName: 'DrawLableBarCode',
      parameter: {
        ...config
      }
    };
  }

  static createLine(config) {
    return {
      apiName: 'DrawLableLine',
      parameter: config
    };
  }

  static createGraph(config) {
    return {
      apiName: 'DrawLableGraph',
      parameter: config
    };
  }

  static createImage(config) {
    return {
      apiName: 'DrawLableImage',
      parameter: config
    };
  }
}

export default PrintElementFactory;