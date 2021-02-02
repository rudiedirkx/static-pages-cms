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
