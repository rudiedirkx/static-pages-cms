"use strict";

const CmsCollectionHelpersCustom = {
	extractCollectionsCustom(object) {
		const collections = {};
		for (let cname in object) {
			const collection = object[cname];
			collections[cname] = new CmsCollection(
				collection.label || collection.name || cname,
				this.extractFieldsCustom(collection.fields),
				this.extractCollectionLocationCustom(collection, cname)
			);
		}

		return collections;
	},

	extractCollectionLocationCustom(collection, name) {
		if (collection.folder) {
			return {folder: collection.folder};
		}

		return {folder: `_${name}`};
	},

	extractFieldsCustom(object) {
		const fields = {};
		for (let fname in object) {
			const field = typeof object[fname] == 'string' ? {widget: object[fname]} : object[fname];
			field.widget = field.widget || field.type || 'string';
			delete field.type;
			field.label = field.label || field.name || fname;
			delete field.name;
			if (field.fields) {
				field.fields = this.extractFieldsCustom(field.fields);
			}
			else if (field.field) {
				field.fields = this.extractFieldsCustom({[CmsWidgetList.ONLY_NAME]: field.field});
				delete field.field;
			}
			fields[fname] = new CmsField(field.widget, field.label, field);
		}

		return fields;
	},
};

const CmsCollectionHelpersNetlify = {
	extractCollectionsNetlify(array) {
		const collections = {};
		for (let collection of array) {
			if (collection.fields) {
				collections[collection.name] = new CmsCollection(
					collection.label,
					this.extractFieldsNetlify(collection.fields),
					this.extractCollectionLocationNetlify(collection)
				);
			}
			else if (collection.files) {
				for (let file of collection.files) {
					const cname = collection.name + ':' + file.name;
					collections[cname] = new CmsCollection(
						file.label || (collection.label + ' - ' + file.name),
						this.extractFieldsNetlify(file.fields),
						this.extractCollectionLocationNetlify(file)
					);
				}
			}
		}

		return collections;
	},

	extractCollectionLocationNetlify(collection) {
		if (collection.file) {
			return {file: collection.file};
		}

		if (collection.folder) {
			return {folder: collection.folder};
		}

		return {};
	},

	extractFieldsNetlify(array) {
		const fields = {};
		for (let field of array) {
			if (field.fields) {
				field.fields = this.extractFieldsNetlify(field.fields);
			}
			else if (field.field) {
				field.field.name = CmsWidgetList.ONLY_NAME;
				field.fields = this.extractFieldsNetlify([field.field]);
				delete field.field;
			}
			else if (field.widget == 'list') {
				field.fields = this.extractFieldsNetlify([{name: CmsWidgetList.ONLY_NAME, widget: 'string'}]);
			}

			fields[field.name] = new CmsField(field.widget, field.label, field);
		}

		return fields;
	},
};

class CmsProvider {
	findConfigFile(tree) {
		return null;
	}

	findMediaFolder(config) {
	}

	findMediaPath(config) {
	}

	async findPages(tree, cms) {
		return tree;
	}

	async findMedia(tree, cms) {
		return this.filterTreeFolders(tree, [cms.mediaFolder]);
	}

	async findCollections(config) {
		return [];
	}

	filterTreeExts(tree, exts) {
		const regex = new RegExp('\\.(' + exts.join('|') + ')$', 'i');
		return tree.filter(file => regex.test(file.path));
	}

	filterTreeFolders(tree, folders) {
		const regex = new RegExp('^(' + folders.join('|') + ')/', 'i');
		return tree.filter(file => regex.test(file.path));
	}

	filterTreeNotFolders(tree, folders) {
		const regex = new RegExp('^(' + folders.join('|') + ')/', 'i');
		return tree.filter(file => !regex.test(file.path));
	}
}

class CmsProviderGithubPages extends CmsProvider {
	// Fields (custom: object) from /_config.yml
	// Folders standard Jekyll? Also from /_config.yml

	findConfigFile(tree) {
		return tree.find(file => file.path == '_config.yml');
	}

	findMediaFolder(config) {
		return config.media_folder;
	}

	findMediaPath(config) {
		return config.public_folder;
	}

	async findPages(tree, cms) {
		return [
			// ...this.filterTreeExts(this.filterTreeFolders(tree, ['_data']), ['yml']),
			...this.filterTreeExts(this.filterTreeNotFolders(tree, ['_data', '_includes', '_layouts']), ['md', 'html']),
		];
	}

	async findCollections(config) {
		return this.extractCollectionsCustom(config.collections);
	}
}

Object.assign(CmsProviderGithubPages.prototype, CmsCollectionHelpersCustom);

class CmsProviderHugoOnNetlify extends CmsProvider {
	// Fields (netlify: array) from /site/static/admin/config.yml
	// Folders & files too

	findConfigFile(tree) {
		return tree.find(file => file.path == 'site/static/admin/config.yml');
	}

	findMediaFolder(config) {
		return config.media_folder;
	}

	findMediaPath(config) {
		return config.public_folder;
	}

	async findPages(tree, cms) {
		return [
			// ...this.filterTreeExts(this.filterTreeFolders(tree, ['site/data']), ['yml']),
			...this.filterTreeExts(this.filterTreeFolders(tree, ['site/content']), ['md', 'html']),
		];
	}

	async findCollections(config) {
		return this.extractCollectionsNetlify(config.collections);
	}
}

Object.assign(CmsProviderHugoOnNetlify.prototype, CmsCollectionHelpersNetlify);

class CmsProviderJekyllOnNetlify extends CmsProvider {
	// Fields (netlify: array) from /admin/config.yml
	// Folders standard Jekyll? Also from /_config.yml

	findConfigFile(tree) {
		return tree.find(file => file.path == 'admin/config.yml');
	}

	findMediaFolder(config) {
		return config.media_folder;
	}

	findMediaPath(config) {
		return config.public_folder;
	}

	async findPages(tree, cms) {
		return [
			// ...this.filterTreeExts(this.filterTreeFolders(tree, ['_data']), ['yml']),
			...this.filterTreeExts(this.filterTreeNotFolders(tree, ['_data', '_includes', '_layouts']), ['md', 'html']),
		];
	}

	async findCollections(config) {
		return this.extractCollectionsNetlify(config.collections);
	}
}

Object.assign(CmsProviderJekyllOnNetlify.prototype, CmsCollectionHelpersNetlify);

CmsContext.PROVIDERS = {
	"Github pages": CmsProviderGithubPages,
	"Hugo on Netlify": CmsProviderHugoOnNetlify,
	"Jekyll on Netlify": CmsProviderJekyllOnNetlify,
};
