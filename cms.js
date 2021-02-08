"use strict";

class CmsUI {
	constructor() {
		this.$collectionButtons = $elCreateButtons;
		this.$selectPageForm = $elPageForm;
		this.$contentForm = $elContentForm;
	}

	loadCollections(collections) {
		this.$contentForm.closest('form').hidden = true;
		this.$collectionButtons.innerHTML = '';
		for (let cname in collections) {
			const collection = collections[cname];
			const btn = document.createElement('button');
			btn.textContent = collection.file ? `(${collection.label})` : collection.label;
			btn.dataset.collection = cname;
			this.$collectionButtons.append(btn);
			this.$collectionButtons.append(' ');
		}
	}

	loadPages(pages) {
		const el = this.$selectPageForm.querySelector('[name="page"]');
		if (el.matches('datalist')) {
			CmsUI.fillDatalistOptions(el, pages.map(file => file.path));
		}
		else {
			const paths = pages.map(file => file.path);
			const labels = this.removeCommonPathStarts(paths);
			CmsUI.fillSelectOptions(el, paths.map((path, i) => [path, labels[i]]));
		}
	}

	loadContentForm(collection) {
		this.$contentForm.innerHTML = '';
		this.$contentForm.closest('form').hidden = false;
		this.$contentForm.append(CmsUI.createFieldset(collection.fields, {
			title: collection.label,
			className: 'root',
		}));
	}

	markOpenCollection(collection) {
		document.querySelectorAll('button[data-collection]').forEach(el => el.classList.remove('active'));
		const btn = document.querySelector(`button[data-collection="${collection}"]`);
		if (btn) {
			btn.classList.add('active');
		}
	}

	removeCommonPathStarts(paths) {
		const maxSections = Math.max(...paths.map(path => path.split('/').length));
		for ( let i = 0; i < maxSections - 1; i++ ) {
			const sections = paths.map(path => path.split('/', 2)[0]);
			if (sections.join('') == sections[0].repeat(paths.length)) {
				paths = paths.map(path => path.split('/').slice(1).join('/'));
			}
			else {
				return paths;
			}
		}
		return paths;
	}

	static fillSelectOptions(sel, options) {
		sel.innerHTML = '';
		options.forEach(opt => {
			const [value, label] = opt instanceof Array ? opt : [opt, opt];
			const el = document.createElement('option');
			el.value = value;
			el.textContent = label;
			sel.append(el);
		});
	}

	static fillDatalistOptions(el, options) {
		el.innerHTML = '';
		options.forEach(value => {
			const opt = document.createElement('option');
			opt.value = value;
			el.append(opt);
		});
	}

	static createLegend(label) {
		const leg = document.createElement('legend');
		leg.classList.add('legend');
		const lbl = document.createElement('span');
		lbl.classList.add('label');
		lbl.textContent = label;
		leg.append(lbl);
		return leg;
	}

	static createFieldset(fields, {title, className, parents = []} = {}) {
		const fs = document.createElement('fieldset');
		fs.open = true;

		if (title) {
			fs.append(CmsUI.createLegend(title));
		}
		else {
			fs.classList.add('structure');
		}

		if (className) {
			fs.classList.add(className);
		}

		for (let fname in fields) {
			const field = fields[fname];
			const parents1 = parents.concat(fname);
			const row = document.createElement('fieldset');
			row.open = true;
			row._field = field;
			row.classList.add('widget');
			row.dataset.widget = field.widget;
			row.dataset.name = fname;
			row.dataset.fullname = '/' + parents1.join('/');
			row.append(CmsUI.createLegend(field.label));
			row.append(CmsUI.createWidget(field, parents1));
			fs.append(row);
			CmsUI.createdWidget(field, row);
		}

		return fs;
	}

	static createWidget(field, parents = []) {
		const handler = WIDGETS[field.widget];
		if (handler) {
			return handler.create(field, parents);
		}

		return document.createTextNode(' ' + field.widget);
	}

	static createdWidget(field, fs) {
		const handler = WIDGETS[field.widget];
		if (handler) {
			return handler.created(fs, field);
		}
	}

	static insertAfterSpace(container, el) {
		container.append(' ');
		container.append(el);
	}

	static setFieldsetValues(fs, values) {
		for (let el of fs.querySelectorAll(':scope > .widget[data-widget][data-name]')) {
			const handler = WIDGETS[el.dataset.widget];
			handler.setValue(el, el._field, values[el.dataset.name]);
		}
	}

	static getFieldsetValues(fs, cms) {
		const values = {};
		for (let el of fs.querySelectorAll(':scope > .widget[data-widget][data-name]')) {
			const handler = WIDGETS[el.dataset.widget];
			values[el.dataset.name] = handler.getValue(el, el._field, cms);
		}
		return values;
	}
}

class CmsContext {
	constructor(ui, provider) {
		this.ui = ui;
		this.provider = provider;

		this.repo = null;
		this.branch = null;
		this.commit = null;

		this.mediaFolder = null;
		this.mediaPath = null;

		this.collections = {};
		this.pages = [];
		this.media = [];

		this.collection = null;
		this.page = null;
		this.content = null;
		this.newFiles = [];
	}

	async getTree(repo, branch) {
		this.repo = repo;
		this.branch = branch || 'master';

		const uri = `/repos/${this.repo}/git/trees/${this.branch}?recursive=1`;
		return github.get(uri).then(rsp => {
			if (!rsp.tree) throw new Error(`Can't find files in repo '${this.repo}:${this.branch}':\n` + JSON.stringify(rsp, null, '  '));
			this.commit = rsp.sha;
			return rsp.tree;
		});
	}

	newFile(file) {
		if (!this.mediaFolder) throw new Error(`Can't upload files. Media folder unknown.`);

		const name = CmsContext.filename(file.name);
console.log(name);

		const path = this.mediaFolder + '/' + name;

		if (this.media.some(f => f.path == path)) throw new Error(`File exists, and I don't overwrite media:\n${path}`);

		if (!this.newFiles.some(f => f.path == path)) {
			this.newFiles.push(new CmsFile(path, file));
console.log(this.newFiles.slice(-1)[0]);
		}

		return this.mediaPath + '/' + name;
	}

	getValues() {
		const fs = this.ui.$contentForm.querySelector('.root');
		return CmsUI.getFieldsetValues(fs, this);
	}

	setValues(values) {
		const fs = this.ui.$contentForm.querySelector('.root');
		return CmsUI.setFieldsetValues(fs, values);
	}

	findCollectionFromPath(path) {
		for ( let cname in this.collections ) {
			const collection = this.collections[cname];
			if (collection.file && collection.file == path) {
				return cname;
			}
			if (collection.folder && path.indexOf(collection.folder + '/') == 0) {
				return cname;
			}
		}
	}

	async loadConfig(config) {
		this.mediaFolder = this.provider.findMediaFolder(config);
		this.mediaPath = this.provider.findMediaPath(config);
		return this;
	}

	async loadCollections(config) {
		this.collections = await this.provider.findCollections(config);
		this.ui.loadCollections(this.collections);
		return this.collections;
	}

	async loadPages(tree) {
		this.pages = await this.provider.findPages(tree, this);
		this.ui.loadPages(this.pages);
		return this.pages;
	}

	async loadMedia(tree) {
		this.media = await this.provider.findMedia(tree, this);
		return this.media;
	}

	loadContentForm(collection, values) {
		this.page = null;
		this.content = values || {};
		this.newFiles = [];

		if (collection instanceof CmsCollection) {
			this.setCurrentCollection(null);
			this.ui.loadContentForm(collection);
		}
		else {
			this.setCurrentCollection(collection);
			this.ui.loadContentForm(this.collections[collection]);
		}

		if (values) {
			this.setValues(values);
		}
	}

	setCurrentCollection(collection) {
		this.ui.markOpenCollection(this.collection = collection);
	}

	static filename(str) {
		return str.trim().toLowerCase().replace(/[^a-z0-9\-\._]+/ig, '-').replace(/(^\-+|\-+$)/g, '').replace(/\-+/g, '-');
	}

	static parseContent(text) {
		const frontMatter = text.match(/^---[\r\n]+([\w\W]+?)---([\r\n]|$)/);
		if (!frontMatter) throw new Error("Can't extract front matter from text:\n" + text);

		const body = text.substr(frontMatter[0].length).trim();
		return {body, ...this.parseYaml(frontMatter[1])};
	}

	static parseConfig(text) {
		return this.parseYaml(text);
	}

	static parseYaml(text) {
		return jsyaml.load(text, {schema: jsyaml.JSON_SCHEMA});
	}
}

class CmsFile {
	constructor(path, content) {
		this.path = path;
		this.content = content;
	}

	async getContent() {
		return this.content instanceof Blob ? this.content.arrayBuffer() : this.content;
	}
}

class CmsCollection {
	constructor(label, fields, options) {
		this.label = label;
		this.fields = {};
		this.folder = this.file = null;

		if (options) {
			if (options.folder) {
				this.folder = options.folder;
			}
			else if (options.file) {
				this.file = options.file;
			}
		}

		fields && this.setFields(fields);
	}

	setFields(fields) {
		this.fields = fields;
		this.ensureBody();
	}

	ensureBody() {
		if (!this.fields.body) {
			this.fields.body = new CmsField('hidden', '~body~');
		}
	}

	static fromContent(values, label) {
		const fields = CmsField.fromValues(values);
		return new CmsCollection(label || 'Unknown', fields);
	}
}

class CmsField {
	constructor(widget, label, options) {
		this.widget = widget;
		this.label = label;

		options && this.addOptions(this.prepareOptions(options));
		if (this.required == null) this.required = true;
	}

	prepareOptions(options) {
		if (WIDGETS[this.widget]) {
			WIDGETS[this.widget].prepareOptions(options);
		}
		return options;
	}

	addOptions(options) {
		for (let opt in options) {
			if (this[opt] === undefined) {
				this[opt] = options[opt];
			}
		}
	}

	static fromValues(values) {
		const fields = {};
		for (let fname in values) {
			fields[fname] = CmsField.fromValue(values[fname], fname);
		}
		return fields;
	}

	static fromValue(value, label) {
		if (typeof value == 'number') {
			return new CmsField('number', label);
		}
		else if (typeof value == 'string') {
			// if (/^\d\d\d\d-\d\d-\d\d$/.test(value)) {
			// 	return new CmsField('date', label);
			// }
			return new CmsField('text', label);
		}
		else if (typeof value == 'boolean') {
			return new CmsField('boolean', label);
		}
		else if (value instanceof Array) {
			return new CmsField('list', label, {
				fields: value.length ? CmsField.fromValues(value[0]) : {},
			});
		}
		else if (typeof value == 'object') {
			return new CmsField('object', label, {
				fields: CmsField.fromValues(value),
			});
		}

		return new CmsField('unknown', label);
	}
}
