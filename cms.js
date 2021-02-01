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
		const el = this.$selectPageForm.querySelector('datalist');
		this.fillDatalistOptions(el, pages.map(file => file.path));
		// select.innerHTML = pages.map((file, i) => `<option value="${i}">${file.path}</option>`).join('');
	}

	loadContentForm(collection, values) {
		this.$contentForm.innerHTML = '';
		this.$contentForm.closest('form').hidden = false;
		this.$contentForm.append(createFieldset(collection.fields, collection.label));

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

	fillSelectOptions(el, options) {

	}

	fillDatalistOptions(el, options) {
		el.innerHTML = '';
		options.forEach(value => {
			const opt = document.createElement('option');
			opt.value = value;
			el.append(opt);
		});
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

		options && this.setOptions(options);
		if (this.required == null) this.required = true;
	}

	setOptions(options) {
		for (let opt in options) {
			if (this[opt] === undefined) {
				this.setOption(opt, options[opt]);
			}
		}
	}

	setOption(name, value) {
		this[name] = value;
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
	create(props) {
	}

	created(fs) {
	}

	getValue(el, props) {
	}

	setValue(el, props, val) {
	}
}

class CmsWidgetInput extends CmsWidget {
	createInput(type) {
		const el = document.createElement('input');
		el.type = type || 'text';
		DEV && el.type != 'file' && (el.value = randomChar());
		return el;
	}

	create(props) {
		return this.createInput();
	}

	getValue(el, props) {
		return el.querySelector('input').value;
	}

	setValue(el, props, val) {
		return el.querySelector('input').value = val == null ? '' : val;
	}
}

class CmsWidgetString extends CmsWidgetInput {
	create(props) {
		return this.createInput('text');
	}
}

class CmsWidgetDate extends CmsWidgetInput {
	create(props) {
		return this.createInput('date');
	}
}

class CmsWidgetDatetime extends CmsWidgetInput {
	create(props) {
		return this.createInput('datetime');
	}
}

class CmsWidgetNumber extends CmsWidgetInput {
	create(props) {
		return this.createInput('number');
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

class CmsWidgetFile extends CmsWidgetInput {
	create(props) {
		return this.createInput('text');
	}
}

class CmsWidgetImage extends CmsWidgetFile {
}

class CmsWidgetSelect extends CmsWidget {
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
	created(fs) {
		fs.hidden = true;
	}
}

class CmsWidgetMarkdown extends CmsWidgetText {
}

class CmsWidgetList extends CmsWidget {
	create(props) {
		return createFieldset(props.fields, 'Item 1');
	}

	getValue(el, props) {
		const items = Array.from(el.querySelectorAll(':scope > fieldset'));
		return items.map(fs => getFieldsetValues(fs));
	}

	setValue(el, props, value) {
		if (!value || !value.length) return;

		el.querySelectorAll(':scope > fieldset').forEach(fs => fs.remove());

		const L = value.length || 1;
		for ( let n = 0; n < L; n++ ) {
			const fs = createFieldset(props.fields, `Item ${n+1}`);
			el.append(fs);
			setFieldsetValues(fs, value[n]);
		}
	}
}

class CmsWidgetObject extends CmsWidget {
	create(props) {
		return createFieldset(props.fields);
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
	"string": new CmsWidgetString(),
	"date": new CmsWidgetDate(),
	"datetime": new CmsWidgetDatetime(),
	"number": new CmsWidgetNumber(),
	"boolean": new CmsWidgetBoolean(),
	"file": new CmsWidgetFile(),
	"image": new CmsWidgetImage(),
	"select": new CmsWidgetSelect(),
	"text": new CmsWidgetText(),
	"markdown": new CmsWidgetMarkdown(),
	"list": new CmsWidgetList(),
	"object": new CmsWidgetObject(),
};
