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
			this.fillDatalistOptions(el, pages.map(file => file.path));
		}
		else {
			const paths = pages.map(file => file.path);
			const labels = this.removeCommonPathStarts(paths);
			this.fillSelectOptions(el, paths.map((path, i) => [path, labels[i]]));
		}
	}

	loadContentForm(collection, values) {
		this.$contentForm.innerHTML = '';
		this.$contentForm.closest('form').hidden = false;
		this.$contentForm.append(CmsUI.createFieldset(collection.fields, collection.label));

		if (values) {
			const fs = this.$contentForm.querySelector('fieldset');
			setFieldsetValues(fs, values);
		}
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

	fillSelectOptions(sel, options) {
		sel.innerHTML = '';
		options.forEach(opt => {
			const [value, label] = opt instanceof Array ? opt : [opt, opt];
			const el = document.createElement('option');
			el.value = value;
			el.textContent = label;
			sel.append(el);
		});
	}

	fillDatalistOptions(el, options) {
		el.innerHTML = '';
		options.forEach(value => {
			const opt = document.createElement('option');
			opt.value = value;
			el.append(opt);
		});
	}

	static createFieldset(fields, title) {
		const fs = document.createElement('fieldset');

		if (title) {
			const leg = document.createElement('legend');
			leg.textContent = title;
			fs.append(leg);
		}
		else {
			fs.classList.add('structure');
		}

		for (let fname in fields) {
			const field = fields[fname];
			const row = document.createElement('fieldset');
			row._field = field;
			row.classList.add('widget');
			row.dataset.widget = field.widget;
			row.dataset.name = fname;
			fs.append(row);
			const leg = document.createElement('legend');
			leg.textContent = field.label;
			row.append(leg);
			row.append(CmsUI.createWidget(field));
			CmsUI.createdWidget(field, row);
		}

		return fs;
	}

	static createWidget(field) {
		const handler = WIDGETS[field.widget];
		if (handler) {
			return handler.create(field);
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
}

class CmsContext {
	constructor(ui, provider) {
		this.ui = ui;
		this.provider = provider;

		this.mediaFolder = null;
		this.mediaPath = null;

		this.collections = {};
		this.pages = [];
		this.media = [];

		this.collection = null;
		this.content = null;
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
		this.content = values || {};

		if (collection instanceof CmsCollection) {
			this.setCurrentCollection(null);
			this.ui.loadContentForm(collection, values);
		}
		else {
			this.setCurrentCollection(collection);
			this.ui.loadContentForm(this.collections[collection], values);
		}
	}

	setCurrentCollection(collection) {
		this.ui.markOpenCollection(this.collection = collection);
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

class CmsWidget {
	prepareOptions(options) {
	}

	create(props) {
	}

	created(fs, props) {
	}

	getValue(el, props) {
	}

	setValue(el, props, val) {
	}

	createInput(type) {
		const el = document.createElement('input');
		el.type = type || 'text';
		DEV && el.type != 'file' && (el.value = randomChar());
		return el;
	}
}

class CmsWidgetInput extends CmsWidget {
	constructor(type) {
		super();
		this.type = type;
	}

	create(props) {
		return this.createInput(this.type);
	}

	getValue(el, props) {
		return el.querySelector('input').value;
	}

	setValue(el, props, val) {
		return el.querySelector('input').value = val == null ? '' : val;
	}
}

class CmsWidgetNumber extends CmsWidgetInput {
	constructor() {
		super('number');
	}

	getValue(el, props) {
		const val = super.getValue(el, props);
		return val === '' ? null : parseFloat(val);
	}
}

class CmsWidgetBoolean extends CmsWidgetInput {
	create(props) {
		return this.createInput('checkbox');
	}

	getValue(el, props) {
		return el.querySelector('input').checked;
	}

	setValue(el, props, val) {
		return el.querySelector('input').checked = val === true;
	}
}

class CmsWidgetFile extends CmsWidget {
	create(props) {
		const div = document.createElement('div');
		div.append(document.createElement('output'));
		div.append(' ');
		div.append(this.createInput('file'));
		return div;
	}

	getValue(el, props) {
		const file = el.querySelector('input').files[0];
		return file ? file.name : el.querySelector('output').value;
	}

	setValue(el, props, val) {
		return el.querySelector('output').value = val || '';
	}
}

class CmsWidgetSelect extends CmsWidget {
	prepareOptions(props) {
		if (props.options instanceof Array) {
			props.options = props.options.map(opt => {
				return typeof opt == 'string' ? {value: opt} : opt;
			});
		}
		else if (typeof props.options == 'object') {
			props.options = Object.entries(props.options).map(([value, label]) => {
				return {value, label};
			});
		}
	}

	create(props) {
		const sel = document.createElement('select');
		[{value: '', label: '--'}, ...(props.options || [])].forEach(opt => {
			const el = document.createElement('option');
			el.value = opt.value || opt.label;
			el.textContent = opt.label || opt.value;
			sel.append(el);
		});
		return sel;
	}

	getValue(el, props) {
		return el.querySelector('select').value;
	}

	setValue(el, props, val) {
		return el.querySelector('select').value = val == null ? '' : val;
	}
}

class CmsWidgetText extends CmsWidget {
	create(props) {
		const el = document.createElement('textarea');
		DEV && (el.value = randomChar());
		return el;
	}

	getValue(el, props) {
		return el.querySelector('textarea').value;
	}

	setValue(el, props, val) {
		return el.querySelector('textarea').value = val == null ? '' : val;
	}
}

class CmsWidgetHidden extends CmsWidgetText {
	created(fs, props) {
		fs.hidden = true;
	}
}

class CmsWidgetMarkdown extends CmsWidgetText {
}

class CmsWidgetList extends CmsWidget {
	static ONLY_NAME = '__value';

	create(props) {
		return CmsUI.createFieldset(props.fields, 'Item 1');
	}

	created(el, props) {
		CmsUI.insertAfterSpace(el.querySelector('legend'), this.makeAddButton(el, props));
		this.addRemove(el.querySelector('fieldset'), props);
		if (props.fields[CmsWidgetList.ONLY_NAME]) {
			el.querySelector(':scope fieldset fieldset').classList.add('structure');
		}
		el.append(this.makeAddButton(el, props));
	}

	makeAddButton(el, props) {
		const btn = document.createElement('button');
		btn.textContent = '+';
		btn.onclick = e => {
			e.preventDefault();
			this.addItem(el, props);
		};
		return btn;
	}

	addItem(container, props) {
		const num = container.querySelectorAll(':scope > fieldset').length+1;
		const fs = CmsUI.createFieldset(props.fields, `Item ${num}`);
		this.addRemove(fs, props);
		if (props.fields[CmsWidgetList.ONLY_NAME]) {
			fs.querySelector('fieldset').classList.add('structure');
		}
		container.append(fs);
		container.append(container.querySelector('legend ~ button'))
		return fs;
	}

	addRemove(fs) {
		const btn = document.createElement('button');
		btn.textContent = 'x';
		btn.onclick = e => {
			e.preventDefault();
			e.target.closest('fieldset').remove();
		};

		CmsUI.insertAfterSpace(fs.querySelector('legend'), btn);
	}

	getValue(el, props) {
		const items = Array.from(el.querySelectorAll(':scope > fieldset'));
		return items.map(fs => {
			const values = getFieldsetValues(fs);
			return props.fields[CmsWidgetList.ONLY_NAME] ? values[CmsWidgetList.ONLY_NAME] : values;
		});
	}

	setValue(el, props, value) {
		if (!value || !value.length) return;

		el.querySelectorAll(':scope > fieldset').forEach(fs => fs.remove());

		const L = value.length || 1;
		for ( let n = 0; n < L; n++ ) {
			const fs = this.addItem(el, props);
			setFieldsetValues(fs, props.fields[CmsWidgetList.ONLY_NAME] ? {[CmsWidgetList.ONLY_NAME]: value[n]} : value[n]);
		}
	}
}

class CmsWidgetObject extends CmsWidget {
	create(props) {
		return CmsUI.createFieldset(props.fields);
	}

	getValue(el, props) {
		return getFieldsetValues(el.querySelector('fieldset'));
	}

	setValue(el, props, value) {
		setFieldsetValues(el.querySelector('fieldset'), value || {});
	}
}

const WIDGETS = {
	"hidden": new CmsWidgetHidden(),
	"string": new CmsWidgetInput('text'),
	"date": new CmsWidgetInput('date'),
	"datetime": new CmsWidgetInput('datetime'),
	"number": new CmsWidgetNumber(),
	"boolean": new CmsWidgetBoolean('checkbox'),
	"file": new CmsWidgetFile(),
	"image": new CmsWidgetFile(),
	"select": new CmsWidgetSelect(),
	"text": new CmsWidgetText(),
	"markdown": new CmsWidgetText(),
	"list": new CmsWidgetList(),
	"object": new CmsWidgetObject(),
};
